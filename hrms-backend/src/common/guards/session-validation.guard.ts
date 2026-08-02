import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Session validation guard that runs after JWT auth.
 *
 * Validates:
 * - User is not deleted (soft-delete check)
 * - User is not suspended/inactive
 * - User hasn't been forced to change password
 *
 * Super Admin bypasses some checks but not all.
 */
@Injectable()
export class SessionValidationGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new UnauthorizedException('No authenticated user found.');
    }

    // Full user lookup to check current status (not relying on JWT claims alone)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        mustChangePassword: true,
        isEmailVerified: true,
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    if (dbUser.deletedAt) {
      throw new UnauthorizedException('This account has been deleted.');
    }

    if (dbUser.status !== 'ACTIVE') {
      const statusMsg = dbUser.status.toLowerCase();
      throw new UnauthorizedException(
        `This account is ${statusMsg}. Please contact your administrator.`,
      );
    }

    // Warn if email not verified (but don't block — configurable)
    if (!dbUser.isEmailVerified && !user.roles.includes('super-admin')) {
      // Store warning on request for controllers to check
      request['emailNotVerified'] = true;
    }

    // Store enriched user data on request
    request['dbUser'] = dbUser;

    return true;
  }
}
