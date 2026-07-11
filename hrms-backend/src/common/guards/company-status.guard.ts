import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Validates that the user's company is in a valid state before allowing
 * any request through.
 *
 * Checks:
 * - Company exists and is active
 * - Company is not suspended
 * - Trial is not expired (if on trial)
 * - Subscription is valid (if on paid plan)
 *
 * Super Admin bypasses this check.
 */
@Injectable()
export class CompanyStatusGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // No user or Super Admin — bypass
    if (!user || user.roles.includes('super-admin')) {
      return true;
    }

    // Platform-level user with no company — bypass
    if (!user.companyId) {
      return true;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });

    if (!company) {
      throw new ForbiddenException('Your company account was not found.');
    }

    if (!company.isActive) {
      throw new ForbiddenException('Your company account is deactivated.');
    }

    if (company.status === 'SUSPENDED') {
      throw new ForbiddenException(
        'Your company account has been suspended. Please contact support.',
      );
    }

    if (company.status === 'CANCELLED') {
      throw new ForbiddenException(
        'Your company account has been cancelled.',
      );
    }

    if (company.status === 'TRIAL_EXPIRED') {
      throw new ForbiddenException(
        'Your trial has expired. Please subscribe to a plan to continue using HRMS.',
      );
    }

    // Auto-expire trial if past end date
    if (
      company.subscriptionPlan === 'TRIAL' &&
      company.trialEndsAt &&
      company.trialEndsAt < new Date()
    ) {
      await this.prisma.company.update({
        where: { id: company.id },
        data: { status: 'TRIAL_EXPIRED' },
      });
      throw new ForbiddenException(
        'Your trial has expired. Please subscribe to a plan to continue using HRMS.',
      );
    }

    return true;
  }
}
