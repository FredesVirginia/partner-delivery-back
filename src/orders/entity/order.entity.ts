import { ChatMessage } from 'src/chat/entity/chat_message.entity';
import { Entity, PrimaryGeneratedColumn , Column , CreateDateColumn , OneToMany } from 'typeorm';
// import { ChatMessage } from '../../chat/entities/chat-message.entity'; // La enlazaremos pronto
export enum OrderStatus {
    PENDING_QUOTATION = "PENDING_QUOTATION",
    PENDING_PAYMENT = "PENDING_PAYMENT",
    COMPLETED = "COMPLETED",
    PAID = "PAID",
}

@Entity("orders")
export class Order {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({name : "client_name" , type: "varchar"})
    clientName: string; 

    @Column({ name: 'client_phone', type: 'varchar' })
    clientPhone: string;

    @Column({name : "origin_name" , type: "varchar"})
    originName: string; 

    @Column({name : "origin_address" , type: "varchar"})
    originAddress: string; 

    @Column({name : "destination_address" , type: "varchar"})
    destinationAddress: string; 

    @Column({type:"text"})
    details:string;

    @Column({
        name: "delivery_price",
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: true,
    })
    deliveryPrice: number;

    @Column({ type: "enum", enum: OrderStatus , default: OrderStatus.PENDING_QUOTATION})
    status: OrderStatus;

    //Esta propiedad es el vínculo con Mercado Pago.
    @Column({ name : "mp_preference" , type : "varchar" , nullable : true})
    mpPreference: string;

    @CreateDateColumn()
    createdAt: Date;

//     @OneToMany(
//   () => ChatMessage,           // 1. ¿Con quién me relaciono?
//   (chatMessage) => chatMessage.order   // 2. ¿Cómo me encuentra esa otra entidad desde ella?
// )

    @OneToMany(() => ChatMessage, (chatMessage) => chatMessage.order)
    chatMessages: ChatMessage[];

}
