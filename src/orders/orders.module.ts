import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order } from './entity/order.entity';
import { ChatModule } from '../chat/chat.module';

@Module({
    imports: [TypeOrmModule.forFeature([Order]), ChatModule],
    controllers: [OrderController],
    providers: [OrderService],
    exports: [OrderService],
})
export class OrdersModule {}
