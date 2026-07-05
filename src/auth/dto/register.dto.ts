import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  firstName: string;

  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @IsString()
  lastName: string;

  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;
}
