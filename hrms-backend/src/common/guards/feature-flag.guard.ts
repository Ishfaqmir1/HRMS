import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Guard that checks whether the current user's company has a specific
 * feature flag enabled. Super Admin always passes.
 *
 * Usage:
 * ```ts
 * @UseGuards(FeatureFlagGuard)
 * @FeatureFlag('payroll')
 * ```
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const featureCode = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No feature flag required — allow
    if (!featureCode) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user found on request.');
    }

    // Super Admin bypass
    if (user.roles.includes('super-admin')) {
      return true;
    }

    // Platform-level users (no company) bypass feature flags
    if (!user.companyId) {
      return true;
    }

    // Check if feature is globally enabled
    const flag = await this.prisma.featureFlag.findUnique({
      where: { code: featureCode },
    });

    if (!flag) {
      // Feature flag doesn't exist in system — deny
      throw new ForbiddenException(`Feature "${featureCode}" is not available.`);
    }

    if (flag.isGlobal) {
      return true; // Global features are always enabled
    }

    // Check per-company override
    const companyFlag = await this.prisma.companyFeatureFlag.findFirst({
      where: {
        companyId: user.companyId,
        featureFlag: { code: featureCode },
      },
    });

    // If no override exists, feature is disabled for this company
    const isEnabled = companyFlag?.isEnabled ?? false;

    if (!isEnabled) {
      throw new ForbiddenException(
        `"${flag.name}" is not enabled for your company. Please upgrade your plan.`,
      );
    }

    return true;
  }
}
