import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Extracts the current tenant (company) id from the authenticated user.
 * Throws if the caller is a platform-level user (companyId === null) trying
 * to hit a tenant-scoped endpoint that requires an explicit company.
 */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const companyId = request.user?.companyId;
  if (!companyId) {
    throw new ForbiddenException('This action requires an authenticated company (tenant) context.');
  }
  return companyId;
});
