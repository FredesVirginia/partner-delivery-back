import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

// El decorador configura el Gateway. Habilitamos CORS para que tu Front (React) pueda conectarse sin bloqueos.
@WebSocketGateway({
  cors: {
    origin: '*', // En producción cambiarás esto por la URL de tu cliente web
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
  @Inject(forwardRef(() => WhatsappService))
  private readonly whatsappService: WhatsappService
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
    @MessageBody() data: { orderId: string }
  ) {
    if (!data.orderId) return;

    // Metemos al cliente en la sala exclusiva de su UUID de orden
    client.join(data.orderId);
    this.logger.log(`Cliente ${client.id} se unió a la sala de la orden: ${data.orderId}`);
    
    // Le confirmamos al cliente que ya está adentro
    client.emit('joined_room', { room: data.orderId });
  }
}