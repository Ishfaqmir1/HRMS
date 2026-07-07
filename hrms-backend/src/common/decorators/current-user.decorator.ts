import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  companyId: string | null;
  employeeId?: string | null;
  roles: string[]; // system role slugs, e.g. ["hr-manager"]
  permissions: string[]; // flattened permission codes, e.g. ["employee.create"]
}

/**
 * Pulls the authenticated user (attached by JwtStrategy) off the request.
 * Usage: findAll(@CurrentUser() user: AuthenticatedUser)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    return data ? user?.[data] : user;
  },
);
