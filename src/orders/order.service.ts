import { Injectable, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dtos/order.dto';
import { Order, OrderStatus } from './entity/order.entity';
import { Message } from './entity/message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappService } from 'src/chat/whatsapp.service';
import { PaymentsService } from 'src/payments/payments.service';
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Message)
    private readonly messageRepository : Repository<Message>,


    private readonly whatsappService: WhatsappService,
    private readonly paymentService : PaymentsService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      const newOrder = this.orderRepository.create(createOrderDto);
      const saveOrder = await this.orderRepository.save(newOrder);

      //NOTIFICAR A ANY POR WHATSAP, AQUI DEBERIA IR SU NUMERO O DEL DELIVERY
      //const numeroAmiga = '593998233853';
      const numeroAmiga = '5492966572349';
      const mensajeParaAmiga =
        `📦 *¡NUEVO PEDIDO RECIBIDO!*\n\n` +
        `👤 *Cliente:* ${saveOrder.clientName}\n` +
        `📍 *Nombre del Lugar:* ${saveOrder.originName}\n` +
        `📍 *Retira en:* ${saveOrder.originAddress}\n` +
        `🏁 *Entrega en:* ${saveOrder.destinationAddress}\n` +
        `📱 *Teléfono:* ${saveOrder.clientPhone}\n` +
        `💬 *Notas:* ${saveOrder.details || 'Ninguna'}\n\n` +
        `----------------------------------------\n` +
        `🆔 *Order ID:* \`${saveOrder.id}\`\n\n` +
        `💡 Responde a este mensaje con:\n` +
        `*/precio [monto]* para cotizar el envío.`;

      //ENVIAMOS EL WHATSAP  CON EL MENSAJE DEL CLIENTE A ANY

      // Modificamos esta parte para capturar lo que devuelve el método sendMessage
      const infoMensaje = await this.whatsappService.sendMessage(
        numeroAmiga,
        mensajeParaAmiga,
      );

      // Si la librería nos devuelve el objeto del mensaje, le extraemos su ID único de WhatsApp
      if (infoMensaje && infoMensaje.id) {
        saveOrder.whatsappMessageId = infoMensaje.id._serialized; // Esto guarda el chorizo largo único del mensaje
        await this.orderRepository.save(saveOrder); // Actualizamos la orden en Postgres con ese ID de mensaje
        this.logger.log(
          `ID de mensaje de WhatsApp vinculado a la orden: ${saveOrder.whatsappMessageId}`,
        );
      }
      return saveOrder;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async updatePriceByMessageId(
    whatsappMessageId: string,
    price: number,
  ): Promise<Order | null> {
    try {
      const order = await this.orderRepository.findOne({
        where: { whatsappMessageId }
      });

      if (!order) {
        this.logger.warn(`No se encontró ninguna orden vinculada al mensaje de WhatsApp: ${whatsappMessageId}`);
        return null;
      }

      // 1. Asignamos el precio real de envío
      order.deliveryPrice = price;
      order.status = OrderStatus.QUOTED;

      // 2. 🚀 LLAMADA MÁGICA A MERCADO PAGO
      // Generamos el link real de Checkout Pro usando el ID, nombre del cliente y el monto cotizado
      const linkDePago = await this.paymentService.createDeliveryPreference(
        order.id, 
        order.clientName, 
        price
      );

      // 3. Guardamos el link en la base de datos (columna mp_preference)
      order.mpPreference = linkDePago;

      // 4. Guardamos todos los cambios en Postgres
      const updatedOrder = await this.orderRepository.save(order);
      this.logger.log(`Orden ${updatedOrder.id} actualizada con precio $${price} y link de Mercado Pago.`);
      
      return updatedOrder;
    } catch (error) {
      this.logger.error('Error al actualizar el precio y generar Mercado Pago:', error);
      return null;
    }
  }

  async saveMessage( orderId : any , sender : "CLIENT" | "ADMIN" , text : string ) : Promise<Message>{
    try {
        const  newMessage = this.messageRepository.create({
            orderId , 
            sender,
            text
        })
        const saveMenssage = await this.messageRepository.save(newMessage)
        return saveMenssage
    }catch(error){
        this.logger.error(error.message, error.stack);
        throw error;
    }
  }
}
