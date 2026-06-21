import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ChatGateway } from './chat.gateway';

@Module({
    providers: [WhatsappService , ChatGateway],
    exports : [WhatsappService , ChatGateway]
})
export class ChatModule {}
