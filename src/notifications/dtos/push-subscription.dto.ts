import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushKeysDto {
  @IsNotEmpty({ message: 'Falta la clave p256dh' })
  @IsString()
  p256dh: string;

  @IsNotEmpty({ message: 'Falta la clave auth' })
  @IsString()
  auth: string;
}

export class SubscribeDto {
  @IsNotEmpty({ message: 'El endpoint es obligatorio' })
  @IsString()
  @MaxLength(500, {
    message: 'El endpoint no puede superar los 500 caracteres',
  })
  endpoint: string;

  @IsNotEmpty({ message: 'Faltan las claves de la suscripción' })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class UnsubscribeDto {
  @IsNotEmpty({ message: 'El endpoint es obligatorio' })
  @IsString()
  @MaxLength(500)
  endpoint: string;
}
