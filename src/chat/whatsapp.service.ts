import {
  Injectable,
  OnModuleInit,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { ChatGateway } from './chat.gateway';
import { OrderService } from '../orders/order.service';
import { Order } from '../orders/entity/order.entity';
import { envs } from '../config';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {
    //INICIAMOS EL CLIENTE DE Whastsapp SIMULANDO UN NAVEGADOR OCULTO
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'delivery-bot', // Esto crea una carpeta local para guardar la sesión
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Clave para evitar problemas de permisos
      },
    });
  }

  onModuleInit() {
    // Permite levantar el backend sin el bot de WhatsApp (local/CI/tests):
    // WA_DISABLED=true evita lanzar Puppeteer y el pareo por QR.
    if (envs.waDisabled) {
      this.logger.warn('WhatsApp deshabilitado (WA_DISABLED=true).');
      return;
    }

    this.initializeBot();
  }

  private initializeBot() {
    // 1. Evento para generar el código QR en la terminal
    this.client.on('qr', (qr) => {
      this.logger.log('¡Código QR generado! Escanéalo con tu WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    // 2. Evento cuando se conecta exitosamente

    this.client.on('ready', () => {
      void this.handleReady();
    });

    this.client.on('message_create', (msg) => {
      void this.handleOwnMessage(msg);
    });

    this.client.on('auth_failure', (msg) => {
      this.logger.error(`Error de autenticación: ${msg}`);
    });

    void this.client.initialize();
  }

  private handleReady(): void {
    this.logger.log('¡El bot de WhatsApp está LISTO y conectado! 🚀');
  }

  private async handleOwnMessage(msg: Message): Promise<void> {
    const texto = msg.body.trim();

    if (!texto.startsWith('/precio')) return;

    const coincidenciaPrecio = texto.match(/\/precio\s*(\d+)/);
    if (!coincidenciaPrecio) return;

    const precioExtraido = parseInt(coincidenciaPrecio[1], 10);
    this.logger.log(`Monto cotizado encontrado: $${precioExtraido}`);

    // 1. Verificar si el mensaje es una respuesta (reply) a otro mensaje
    if (!msg.hasQuotedMsg) {
      await msg.reply(
        `💡 Por favor, responde (manten presionando y dale a 'Responder') al mensaje del pedido para que sepa qué orden estás cotizando.`,
      );
      return;
    }

    const msgCitado = await msg.getQuotedMessage();
    const idMensajeOriginal = msgCitado.id._serialized; // El ID del mensaje que el bot mandó primero

    this.logger.log(
      `Buscando orden para el mensaje citado: ${idMensajeOriginal}`,
    );

    // 2. Buscamos y actualizamos la orden en Postgres con el precio real
    const ordenActualizada = await this.orderService.updatePriceByMessageId(
      idMensajeOriginal,
      precioExtraido,
    );

    if (!ordenActualizada) {
      await msg.reply(
        `❌ No encontré ninguna orden activa vinculada a este mensaje.`,
      );
      return;
    }

    // 3. Emitimos el precio EN VIVO por WebSockets usando el ID REAL de la orden
    this.chatGateway.server
      .to(ordenActualizada.id.toString())
      .emit('price_quoted', {
        orderId: ordenActualizada.id,
        price: ordenActualizada.deliveryPrice,
        status: ordenActualizada.status,
        mpLink: ordenActualizada.mpPreference,
      });

    this.logger.log(
      `¡Transmitido con éxito al socket de la orden REAL: ${ordenActualizada.id}!`,
    );
    await msg.reply(
      `✅ ¡Perfecto! Registrado precio de $${precioExtraido} para la orden de ${ordenActualizada.clientName}. Transmitido a la web.`,
    );
  }

  /**
   * Envía un mensaje de texto a un número específico
   * @param to Número de teléfono destino (ej: '5491123456789')
   * @param body El texto del mensaje que se va a enviar
   */
  async sendMessage(to: string, body: string): Promise<Message | null> {
    try {
      // Limpiamos el número por si viene con espacios, guiones o un '+'
      const cleanNumber = to.replace(/\D/g, '');

      // Le damos el formato que exige WhatsApp Web: 'numero@c.us'
      const whatsappId = `${cleanNumber}@c.us`;

      // Enviamos el mensaje usando el cliente de la librería
      const sentMessage = await this.client.sendMessage(whatsappId, body);

      this.logger.log(`Mensaje enviado con éxito a: ${whatsappId}`);
      return sentMessage;
    } catch (error) {
      this.logger.error(`Error al enviar mensaje a ${to}:`, error);
      return null;
    }
  }

  /**
   * Notifica a la operadora que entró un pedido nuevo y guarda el ID del mensaje en la orden.
   */
  async notifyNewOrder(order: Order): Promise<void> {
    const numeroAmiga = envs.operatorPhone;

    const mensajeParaAmiga =
      `📦 *¡NUEVO PEDIDO RECIBIDO!*\n\n` +
      `👤 *Cliente:* ${order.clientName}\n` +
      `📍 *Nombre del Lugar:* ${order.originName}\n` +
      `📍 *Retira en:* ${order.originAddress}\n` +
      `🏁 *Entrega en:* ${order.destinationAddress}\n` +
      `📱 *Teléfono:* ${order.clientPhone}\n` +
      `💬 *Notas:* ${order.details || 'Ninguna'}\n\n` +
      `----------------------------------------\n` +
      `🆔 *Order ID:* \`${order.id}\`\n\n` +
      `💡 Responde a este mensaje con:\n` +
      `*/precio [monto]* para cotizar el envío.`;

    const infoMensaje = await this.sendMessage(numeroAmiga, mensajeParaAmiga);

    if (infoMensaje && infoMensaje.id) {
      await this.orderService.attachWhatsappMessageId(
        order.id,
        infoMensaje.id._serialized,
      );
    }
  }
}
