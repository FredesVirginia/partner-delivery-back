import { IsNotEmpty, IsString } from 'class-validator';

export class SaveSessionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  data: string;
}