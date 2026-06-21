import {IsEnum, IsNotEmpty , IsNumber, IsString, IsUUID}  from 'class-validator';
import { SenderEnum } from '../entity/chat_message.entity';

export class CreateChatMessageDto {
    @IsNotEmpty()
    @IsString()
    message: string;

    @IsNotEmpty()
    @IsUUID()
    orderId: string;

    @IsNotEmpty()
    @IsEnum(SenderEnum)
    typeSender: SenderEnum;

    
}