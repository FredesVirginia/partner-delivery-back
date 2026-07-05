import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';

export const ROLES_KEY = 'roles';

/** Restringe una ruta/controlador a los roles indicados (lo evalúa RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
