import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SystemRole } from '../enums/role.enum';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user found on request.');
    }

    // SUPER_ADMIN implicitly satisfies any role requirement.
    if (user.roles.includes('super-admin')) {
      return true;
    }

    const hasRole = requiredRoles.some((role) =>
      user.roles.includes(role.toLowerCase().replace(/_/g, '-')),
    );

    if (!hasRole) {
      throw new ForbiddenException('You do not have the required role to perform this action.');
    }

    return true;
  }
}
