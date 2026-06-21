import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dtos/order.dto';

@Controller('orders') //Esto hace que todos los endpoits empiecen con orders
export class OrderController {
    constructor(
        private readonly orderService : OrderService
    ){}

    @Post()
    @HttpCode(HttpStatus.CREATED)//DEVUELE UN CODIGO 201 SI TODO SALE BIEN
    create(@Body() createOrderDto : CreateOrderDto){
       return this.orderService.create(createOrderDto);
    }
}
