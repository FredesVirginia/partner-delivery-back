import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OrderService } from './order.service';
import { WhatsappService } from '../chat/whatsapp.service';
import { CreateOrderDto } from './dtos/order.dto';

@Controller('orders') //Esto hace que todos los endpoits empiecen con orders
export class OrderController {
    constructor(
        private readonly orderService: OrderService,
        private readonly whatsappService: WhatsappService,
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)//DEVUELE UN CODIGO 201 SI TODO SALE BIEN
    async create(@Body() createOrderDto: CreateOrderDto) {
        const order = await this.orderService.create(createOrderDto);
        await this.whatsappService.notifyNewOrder(order); // Avisamos a la operadora
        return order;
    }
}
