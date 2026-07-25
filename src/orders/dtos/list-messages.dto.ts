import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1)
  @Max(100, { message: 'limit no puede superar 100' })
  limit?: number = 50;

  @IsOptional()
  @IsDateString({}, { message: 'before debe ser una fecha ISO' })
  before?: string;
}
