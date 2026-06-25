import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order } from './entity/order.entity';
import { ChatModule } from '../chat/chat.module';
import { Message } from './entity/message.entity';
import { PaymentsModule } from '../payments/payments.module';

@Module({
    imports: [TypeOrmModule.forFeature([Order , Message]), forwardRef(() => ChatModule), forwardRef(() => PaymentsModule)],
    controllers: [OrderController],
    providers: [OrderService],
    exports: [OrderService],
})
export class OrdersModule {}
