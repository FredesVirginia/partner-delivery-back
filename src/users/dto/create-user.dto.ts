import { UserRole } from '../enums/user-role.enum';

/**
 * DTO interno usado por AuthService para crear un usuario ya con el hash de la
 * contraseña calculado. No se expone directamente en ningún endpoint.
 */
export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role?: UserRole;
}
