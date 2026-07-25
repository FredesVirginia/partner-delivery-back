import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '../entity/order.entity';

export class ListOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'limit no puede superar 100' })
  limit?: number = 50;

  @IsOptional()
  @IsEnum(OrderStatus, { message: 'status no es un estado válido' })
  status?: OrderStatus;
}
