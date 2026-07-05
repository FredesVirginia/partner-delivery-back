import { UserRole } from '../../users/enums/user-role.enum';

/** Payload del access token: mínimo e informativo, sin datos sensibles. */
export interface JwtPayload {
  sub: string; // id del usuario
  email: string;
  role: UserRole;
}

/** Payload del refresh token: identifica el registro rotable en BD. */
export interface RefreshTokenPayload {
  sub: string; // id del usuario
  tokenId: string; // id del registro en refresh_tokens
}
