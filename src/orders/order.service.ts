import {
  Inject,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { ChatGateway } from 'src/chat/chat.gateway';
import { describeError } from 'src/common/utils/error.util';
import { PaymentsService } from 'src/payments/payments.service';
import { CreateOrderDto } from './dtos/order.dto';
import { Message } from './entity/message.entity';
import { Order, OrderStatus } from './entity/order.entity';
import { User } from 'src/users/entity/user.entity';
import { UserRole } from 'src/users/enums/user-role.enum';
import { FindOptionsWhere, LessThan, Repository, IsNull } from 'typeorm';
import { ListMessagesDto } from './dtos/list-messages.dto';
import { ListOrdersDto } from './dtos/list-orders.dto';
import { CreateMessageDto } from './dtos/create-message.dto';
import { PushService } from 'src/notifications/push.service';

export interface InboxItem {
  id: number;
  status: OrderStatus;
  clientName: string;
  clientPhone: string;
  destinationAddress: string;
  deliveryPrice: number | null;
  createdAt: Date;
  lastMessage: { text: string; sender: string; createdAt: Date } | null;
  unreadCount: number;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,

    private readonly paymentService: PaymentsService,
    private readonly pushService: PushService,
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    try {
      const newOrder = this.orderRepository.create({
        ...createOrderDto,
        userId,
      });
      const saveOrder = await this.orderRepository.save(newOrder);
      return saveOrder;
    } catch (error) {
      const { message, stack } = describeError(error);
      this.logger.error(message, stack);
      throw error;
    }
  }

  async findForUser(orderId: number, user: User): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`No existe el orden ${orderId}`);
    }
    //AQUI el ADMIN antiende todos lo mensajes que le llegan
    //y el cliente solo ve su propios mensajes con el Adnmin
    if (user.role !== UserRole.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('Esta orden no te pertenece');
    }

    return order;
  }

  async findMyOrders(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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

      void this.notifyQuoted(updatedOrder);

      return updatedOrder;
    } catch (error) {
      const { message, stack } = describeError(error);
      this.logger.error(
        `Error al actualizar el precio y generar Mercado Pago: ${message}`,
        stack,
      );
      return null;
    }
  }

  async saveMessage(
    orderId: number,
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
      const { message, stack } = describeError(error);
      this.logger.error(message, stack);
      throw error;
    }
  }

  async markAsPaid(orderId: number): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });
      if (order) {
        order.status = OrderStatus.PAID; // Pasamos a pagado
        await this.orderRepository.save(order);

        // 🚀 ¡Avisamos en tiempo real por el socket que ya está pago!
        // Evento propio (NO 'price_quoted') para no pisar la lógica del botón de pago.
        this.chatGateway.server.to(orderId.toString()).emit('order_paid', {
          orderId: order.id,
          price: order.deliveryPrice,
          status: OrderStatus.PAID,
        });

        this.logger.log(
          `📢 Orden #${orderId} marcada como PAGADA y notificada por Sockets.`,
        );

        void this.notifyPaid(order);
      }
    } catch (error) {
      const { stack } = describeError(error);
      this.logger.error(`Error al marcar como paga la orden ${orderId}`, stack);
    }
  }

  async historyMessages(
    orderId: number,
    user: User,
    { limit = 50, before }: ListMessagesDto,
  ): Promise<Message[]> {
    await this.findForUser(orderId, user);

    const where: FindOptionsWhere<Message> = { orderId };
    if (before) {
      where.createdAt = LessThan(new Date(before));
    }

    const messages = await this.messageRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return messages.reverse();
  }

  async listInboxAdmin({
    limit = 50,
    status,
  }: ListOrdersDto): Promise<InboxItem[]> {
    // 1) Las órdenes.
    const orders = await this.orderRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: limit,
    });

    if (orders.length === 0) return [];

    const orderIds = orders.map((order) => order.id);

    // 2) El último mensaje de cada conversación, en UNA consulta.

    const lastMessages = await this.messageRepository
      .createQueryBuilder('m')
      .distinctOn(['m.orderId'])
      .where('m.orderId IN (:...orderIds)', { orderIds })
      .orderBy('m.orderId')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();

    // 3) Los no leídos, también en UNA consulta.
    const unreadRows = await this.messageRepository
      .createQueryBuilder('m')
      .select('m.orderId', 'orderId')
      .addSelect('COUNT(*)', 'count')
      .where('m.orderId IN (:...orderIds)', { orderIds })
      .andWhere('m.sender = :sender', { sender: 'CLIENT' })
      .andWhere('m.readAt IS NULL')
      .groupBy('m.orderId')
      .getRawMany<{ orderId: number; count: string }>();

    // Los pasamos a mapas para armar el resultado sin volver a consultar.
    const lastByOrder = new Map(lastMessages.map((m) => [m.orderId, m]));
    const unreadByOrder = new Map(
      unreadRows.map((row) => [Number(row.orderId), Number(row.count)]),
    );

    return orders.map((order) => {
      const last = lastByOrder.get(order.id);
      return {
        id: order.id,
        status: order.status,
        clientName: order.clientName,
        clientPhone: order.clientPhone,
        destinationAddress: order.destinationAddress,
        deliveryPrice: order.deliveryPrice ?? null,
        createdAt: order.createdAt,
        lastMessage: last
          ? { text: last.text, sender: last.sender, createdAt: last.createdAt }
          : null,
        unreadCount: unreadByOrder.get(order.id) ?? 0,
      };
    });
  }

  async sendMessage(
    orderId: number,
    user: User,
    { text }: CreateMessageDto,
  ): Promise<Message> {
    const order = await this.findForUser(orderId, user);
    const sender = user.role === UserRole.ADMIN ? 'ADMIN' : 'CLIENT';
    const message = await this.saveMessage(orderId, sender, text);
    this.chatGateway.server.to(orderId.toString()).emit('new_message', message);

    void this.notifyNewMessage(order, sender, text);

    return message;
  }

  private async notifyQuoted(order: Order): Promise<void> {
    try {
      await this.pushService.sendToUser(order.userId, {
        title: 'Tu envío ya tiene precio 🛵',
        body: `Pedido #${order.id}: $${order.deliveryPrice}. Entrá para pagarlo.`,
        url: `/chat/${order.id}`,
        tag: `order-${order.id}`,
      });
    } catch (error) {
      const { message, stack } = describeError(error);
      this.logger.error(
        `No se pudo notificar la cotización de la orden ${order.id}: ${message}`,
        stack,
      );
    }
  }

  private async notifyPaid(order: Order): Promise<void> {
    try {
      await this.pushService.sendToAdmins({
        title: 'Pago acreditado 💰',
        body: `${order.clientName} pagó $${order.deliveryPrice}. El pedido #${order.id} está listo para salir.`,
        url: `/chat/${order.id}`,
        tag: `order-${order.id}`,
      });
    } catch (error) {
      const { message, stack } = describeError(error);
      this.logger.error(
        `No se pudo notificar el pago de la orden ${order.id}: ${message}`,
        stack,
      );
    }
  }

  private async notifyNewMessage(
    order: Order,
    sender: 'CLIENT' | 'ADMIN',
    text: string,
  ): Promise<void> {
    const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
    const url = `/chat/${order.id}`;
    const tag = `order-${order.id}`;

    try {
      if (sender === 'CLIENT') {
        await this.pushService.sendToAdmins({
          title: `Nuevo mensaje de ${order.clientName}`,
          body: preview,
          url,
          tag,
        });
      } else {
        await this.pushService.sendToUser(order.userId, {
          title: `Pedido #${order.id}`,
          body: preview,
          url,
          tag,
        });
      }
    } catch (error) {
      const { message, stack } = describeError(error);
      this.logger.error(
        `No se pudo notificar el mensaje de la orden ${order.id}: ${message}`,
        stack,
      );
    }
  }

  async markMessagesAsRead(
    orderId: number,
    user: User,
  ): Promise<{ updated: number }> {
    await this.findForUser(orderId, user);
    const otherSide = user.role === UserRole.ADMIN ? 'CLIENT' : 'ADMIN';
    const result = await this.messageRepository.update(
      { orderId, sender: otherSide, readAt: IsNull() },
      { readAt: new Date() },
    );

    return { updated: result.affected ?? 0 };
  }
}
