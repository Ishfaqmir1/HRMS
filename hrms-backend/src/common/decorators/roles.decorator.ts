import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to users holding at least one of the given system roles.
 * Use alongside RolesGuard. For fine-grained checks prefer @Permissions().
 */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
