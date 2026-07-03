import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Message } from 'src/orders/entity/message.entity';
import { Repository } from 'typeorm';

// El decorador configura el Gateway. Habilitamos CORS para que tu Front (React) pueda conectarse sin bloqueos.
@WebSocketGateway({
  cors: {
    origin: '*', // En producción cambiarás esto por la URL de tu cliente web
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    @InjectRepository(Message)
  private readonly messageRepository: Repository<Message>,
  ) {}
  @WebSocketServer()
  server: Server; // Esta variable nos da acceso a todo el servidor de Socket.io

  private readonly logger = new Logger(ChatGateway.name);

  // Se ejecuta automáticamente cuando un cliente (Front) abre la página y se conecta
  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado al socket: ${client.id}`);
  }

  // Se ejecuta cuando el cliente cierra la pestaña o pierde internet
  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  /**
   * Evento para que el Front se una a la sala de su pedido
   * El Front emitirá: socket.emit('join_order', { orderId: '...' })
   */
  @SubscribeMessage('join_order')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!data.orderId) return;

    // Metemos al cliente en la sala exclusiva de su UUID de orden
    client.join(data.orderId);
    this.logger.log(
      `Cliente ${client.id} se unió a la sala de la orden: ${data.orderId}`,
    );

    // Le confirmamos al cliente que ya está adentro
    client.emit('joined_room', { room: data.orderId });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { orderId: any; sender: 'CLIENT' | 'ADMIN'; text: string },
  ) {
    try {
      if (!data.orderId || !data.text) return;
      //GUATDAMOS EL MENSAJE EN POSTGRESS
      const saveMessage = await this.messageRepository.create({
        orderId: data.orderId,
        sender: data.sender,
        text: data.text,
      });
      await this.messageRepository.save(saveMessage);
      // 2. Le transmitimos el mensaje a TODOS los que estén sintonizando esa sala de la orden
      // Esto incluye a la otra punta (si el cliente escribió, le llega al panel de tu amiga, y viceversa)
      this.server.to(data.orderId.toString()).emit('new_message', saveMessage);

      this.logger.log(
        `Mensaje de [${data.sender}] transmitido en sala ${data.orderId}`,
      );
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
}
