import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatGateway } from 'src/chat/chat.gateway';
import { PaymentsService } from 'src/payments/payments.service';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dtos/order.dto';
import { Message } from './entity/message.entity';
import { Order, OrderStatus } from './entity/order.entity';
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,

    private readonly paymentService: PaymentsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      const newOrder = this.orderRepository.create(createOrderDto);
      const saveOrder = await this.orderRepository.save(newOrder);
      return saveOrder;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async attachWhatsappMessageId(
    orderId: number,
    whatsappMessageId: string,
  ): Promise<void> {
    await this.orderRepository.update(orderId, { whatsappMessageId });
    this.logger.log(
      `ID de mensaje de WhatsApp vinculado a la orden ${orderId}: ${whatsappMessageId}`,
    );
  }

  async updatePriceByMessageId(
    whatsappMessageId: string,
    price: number,
  ): Promise<Order | null> {
    try {
      const order = await this.orderRepository.findOne({
        where: { whatsappMessageId },
      });

      if (!order) {
        this.logger.warn(
          `No se encontró ninguna orden vinculada al mensaje de WhatsApp: ${whatsappMessageId}`,
        );
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
        price,
      );

      // 3. Guardamos el link en la base de datos (columna mp_preference)
      order.mpPreference = linkDePago;

      // 4. Guardamos todos los cambios en Postgres
      const updatedOrder = await this.orderRepository.save(order);
      this.logger.log(
        `Orden ${updatedOrder.id} actualizada con precio $${price} y link de Mercado Pago.`,
      );

      return updatedOrder;
    } catch (error) {
      this.logger.error(
        'Error al actualizar el precio y generar Mercado Pago:',
        error,
      );
      return null;
    }
  }

  async saveMessage(
    orderId: any,
    sender: 'CLIENT' | 'ADMIN',
    text: string,
  ): Promise<Message> {
    try {
      const newMessage = this.messageRepository.create({
        orderId,
        sender,
        text,
      });
      const saveMenssage = await this.messageRepository.save(newMessage);
      return saveMenssage;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async markAsPaid(orderId: any): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });
      if (order) {
        order.status = 'PAID' as any; // Pasamos a pagado
        await this.orderRepository.save(order);

        // 🚀 ¡Avisamos en tiempo real por el socket que ya está pago!
        // Evento propio (NO 'price_quoted') para no pisar la lógica del botón de pago.
        this.chatGateway.server.to(orderId.toString()).emit('order_paid', {
          orderId: order.id,
          price: order.deliveryPrice,
          status: 'PAID',
        });

        this.logger.log(
          `📢 Orden #${orderId} marcada como PAGADA y notificada por Sockets.`,
        );
      }
    } catch (error) {
      this.logger.error(`Error al marcar como paga la orden ${orderId}`, error);
    }
  }
}
