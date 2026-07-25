import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty({ message: 'El mensaje no puede estar vacío' })
  @IsString()
  @MaxLength(2000, {
    message: 'El mensaje no puede superar los 2000 caracteres',
  })
  text: string;
}
