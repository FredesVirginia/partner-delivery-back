import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';

import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    JwtModule.register({}),
    UsersModule,
  ],
  providers: [WhatsappService, ChatGateway],
  exports: [WhatsappService, ChatGateway],
})
export class ChatModule {}
