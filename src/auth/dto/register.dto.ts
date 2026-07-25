import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  userName: string;

  @IsString()
  address: string;

  @IsString()
  phone: string;

  @IsString()
  neighborhood: string;

  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsString()
  location?: string;
}
