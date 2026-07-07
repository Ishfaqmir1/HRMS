import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restricts a route to users whose effective role(s) grant ALL of the given
 * permission codes (e.g. 'employee.create', 'payroll.approve').
 * Use alongside PermissionsGuard.
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
