import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappService } from './whatsapp.service';
import { ChatGateway } from './chat.gateway';
import { ChatMessage } from './entity/chat_message.entity';
import { WhatsappSeccion } from './entity/whatsapp-seccion.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ChatMessage, WhatsappSeccion])],
    providers: [WhatsappService , ChatGateway],
    exports : [WhatsappService , ChatGateway]
})
export class ChatModule {}
