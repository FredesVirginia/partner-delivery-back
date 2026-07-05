/**
 * Roles de usuario del sistema. Extensible: cuando se sumen flujos de delivery
 * se podrán agregar OPERATOR (operadora) o COURIER (cadete).
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
}
