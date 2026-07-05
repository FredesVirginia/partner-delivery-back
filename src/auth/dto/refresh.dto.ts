import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @IsNotEmpty({ message: 'El refresh token es obligatorio' })
  @IsJWT({ message: 'El refresh token no es válido' })
  refreshToken: string;
}
