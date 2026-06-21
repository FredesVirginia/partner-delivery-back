import { Order } from 'src/orders/entity/order.entity';
import { Entity, PrimaryGeneratedColumn , Column , CreateDateColumn , ManyToOne , JoinColumn } from 'typeorm';

export enum SenderEnum{
    CLIENT = "CLIENT",
    ADMIN = "ADMIN",
    SYSTEM = "SYSTEM",
}

@Entity("chat_messages")
export class ChatMessage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({name : "type_sender" , type: "enum", enum: SenderEnum , default: SenderEnum.CLIENT})
    typeSender: SenderEnum;

    @Column({type:"text"})
    message:string;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Order, (order) => order.chatMessages)
    @JoinColumn({name:"order_id"})
    order: Order;

}