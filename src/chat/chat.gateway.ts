import {
  Inject,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { OrderService } from 'src/orders/order.service';

import { JwtService } from '@nestjs/jwt';
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
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';
import { describeError } from 'src/common/utils/error.util';
import { envs } from 'src/config';
import { User } from 'src/users/entity/user.entity';
import { UsersService } from 'src/users/users.service';

// Socket ya autenticado
interface AuthSocketData {
  user: User;
}

type AuthSocket = Socket<any, any, any, AuthSocketData>;

@WebSocketGateway({
  cors: {
    origin: '*', // En producción cambiarás esto por la URL de tu cliente web
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  @WebSocketServer()
  server: Server; // Esta variable nos da acceso a todo el servidor de Socket.io

  private readonly logger = new Logger(ChatGateway.name);

  async handleConnection(client: AuthSocket) {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      this.logger.log(`Cliente conectado: ${client.id} (${user.email})`);
    } catch {
      this.logger.warn(`Conexión rechazada por token inválido: ${client.id}`);
      client.emit('auth_error', { message: 'Token inválido o ausente' });
      client.disconnect(true);
    }
  }

  private async authenticate(client: AuthSocket): Promise<User> {
    const authToken = client.handshake.auth?.token as string | undefined;
    const headerToken = client.handshake.headers.authorization?.replace(
      'Bearer ',
      '',
    );
    const token = authToken ?? headerToken;

    if (!token) {
      throw new UnauthorizedException('Falta el token');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: envs.jwtAccessSecret,
    });

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario inexistente o inactivo');
    }

    return user;
  }

  // Se ejecuta cuando el cliente cierra la pestaña o pierde internet
  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('join_order')
  async handleJoinOrder(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { orderId: number },
  ) {
    if (!data?.orderId) return;

    const user = client.data.user;
    const room = String(data.orderId);

    try {
      await this.orderService.findForUser(Number(data.orderId), user);
    } catch {
      this.logger.warn(
        `${user.email} intentó entrar a la sala ${room} sin permiso`,
      );
      client.emit('join_error', {
        orderId: data.orderId,
        message: 'No tenés acceso a este chat',
      });
      return;
    }

    void client.join(room);
    this.logger.log(`${user.email} se unió a la sala de la orden ${room}`);
    client.emit('joined_room', { room });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { orderId: number; text: string },
  ) {
    if (!data?.orderId || !data?.text) return;

    try {
      await this.orderService.sendMessage(
        Number(data.orderId),
        client.data.user,
        { text: data.text },
      );
    } catch (error) {
      const { message, stack } = describeError(error);
      this.logger.error(message, stack);
      client.emit('message_error', { message: 'No se pudo enviar el mensaje' });
    }
  }
}
