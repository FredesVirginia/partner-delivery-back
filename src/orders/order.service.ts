import { Injectable, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dtos/order.dto';
import { Order } from './entity/order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappService } from 'src/chat/whatsapp.service';
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly whatsappService: WhatsappService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      const newOrder = this.orderRepository.create(createOrderDto);
      const saveOrder = await this.orderRepository.save(newOrder);

      //NOTIFICAR A ANY POR WHATSAP, AQUI DEBERIA IR SU NUMERO O DEL DELIVERY
      const numeroAmiga = '593998233853';

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
        this.whatsappService.sendMessage(numeroAmiga, mensajeParaAmiga);
        return saveOrder;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
