import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Extracts the current tenant (company) id from the authenticated user.
 *
 * - For **tenant users** (companyId set on the JWT): returns their company id.
 * - For **Super Admin** (companyId === null): checks for a `companyId` query
 *   parameter so the super admin can operate on any specific tenant. If no
 *   query parameter is provided, a helpful error is thrown.
 * - For **platform-only users** without a company context and who are not
 *   super-admins: throws an access-denied error.
 */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  const userCompanyId = user?.companyId;

  // Normal tenant user – return their company id.
  if (userCompanyId) {
    return userCompanyId;
  }

  // Super Admin without a company – allow query-param override.
  if (user?.roles?.includes('super-admin')) {
    const queryCompanyId: string | undefined = request.query?.companyId;
    if (queryCompanyId) {
      return queryCompanyId;
    }
    throw new BadRequestException(
      'Super Admin must provide a "companyId" query parameter to access tenant-scoped data.',
    );
  }

  // Any other user without a company context.
  throw new ForbiddenException('This action requires an authenticated company (tenant) context.');
});
