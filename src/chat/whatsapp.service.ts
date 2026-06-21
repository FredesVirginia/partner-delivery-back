import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { ChatGateway } from './chat.gateway';
@Injectable()
export class WhatsappService implements OnModuleInit {
  private client: Client;
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @Inject(forwardRef(() => ChatGateway))
  private readonly chatGateway: ChatGateway
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
    this.initializeBot();
  }

  private initializeBot() {
    // 1. Evento para generar el código QR en la terminal
    this.client.on('qr', (qr) => {
      this.logger.log('¡Código QR generado! Escanéalo con tu WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    // 2. Evento cuando se conecta exitosamente
    this.client.on('ready', async () => {
     this.logger.log('¡El bot de WhatsApp está LISTO y conectado! 🚀');
      
      // PRUEBA FUGAZ: Pon un número real tuyo con el código de país (ej: '54911...' para Argentina)
      // ¡No uses el signo '+' ni guiones!
     const numeroPrueba = '5492966469771';
      
      this.logger.log('Enviando mensaje de prueba...');
      await this.sendMessage(numeroPrueba, '¡Hola! Soy tu backend de NestJS probando los motores. 🤖📦');
    });

    // 4. Evento que escucha TODOS los mensajes entrantes
    this.client.on('message', async (msg) => {
      const texto = msg.body.trim();
      
      // Verificamos si el mensaje empieza con nuestro comando mágico
      if (texto.startsWith('/precio')) {
        this.logger.log(`¡Comando de cotización detectado de parte de: ${msg.from}!`);
        
        // Expresión regular para extraer solo los números del mensaje
        // Esto entenderá tanto "/precio 1500" como "/precio1500"
        const coincidenciaPrecio = texto.match(/\/precio\s*(\d+)/);
        
        if (coincidenciaPrecio) {
          const precioExtraido = parseInt(coincidenciaPrecio[1], 10);
          this.logger.log(`Monto cotizado encontrado: $${precioExtraido}`);
          
          // TODO: Aquí dispararemos el evento de NestJS para avisar al módulo de pagos y al chat web.
          // Por ahora, le respondemos a tu amiga para confirmar que el bot entendió.
          await msg.reply(`✅ Entendido. Registré el precio de $${precioExtraido}. Generando link de pago...`);
        } else {
          await msg.reply('❌ Formato incorrecto. Por favor escribe: /precio [monto] (ejemplo: /precio 1200)');
        }
      }
    });

    this.client.on('message_create', async (msg) => {
      const texto = msg.body.trim();
      
      if (texto.startsWith('/precio')) {
        const coincidenciaPrecio = texto.match(/\/precio\s*(\d+)/);
        
        if (coincidenciaPrecio) {
          const precioExtraido = parseInt(coincidenciaPrecio[1], 10);
          this.logger.log(`Monto cotizado encontrado: $${precioExtraido}`);

          // ⚠️ NOTA TEMPORAL: Como todavía no recuperamos el orderId real de la base de datos,
          // vamos a inventar un "order_id_de_prueba" simulado para testear el flujo del socket.
          const orderIdSimulado = 'orden-prueba-123';

          // Emitimos el precio en tiempo real a la sala de esa orden en el Front
          this.chatGateway.server.to(orderIdSimulado).emit('price_quoted', {
            orderId: orderIdSimulado,
            price: precioExtraido,
            status: 'QUOTED'
          });

          this.logger.log(`Transmitido precio de $${precioExtraido} a la sala de socket: ${orderIdSimulado}`);

          await msg.reply(`✅ Entendido. Registré el precio de $${precioExtraido}. Transmitiendo a la web...`);
        }
      }
    });

    // 3. Evento por si falla la autenticación
    this.client.on('auth_failure', (msg) => {
      this.logger.error(`Error de autenticación: ${msg}`);
    });

    // Arrancamos el proceso
    this.client.initialize();
  }

  /**
   * Envía un mensaje de texto a un número específico
   * @param to Número de teléfono destino (ej: '5491123456789')
   * @param body El texto del mensaje que se va a enviar
   */
  async sendMessage(to: string, body: string): Promise<boolean> {
    try {
      // Limpiamos el número por si viene con espacios, guiones o un '+'
      const cleanNumber = to.replace(/\D/g, '');

      // Le damos el formato que exige WhatsApp Web: 'numero@c.us'
      const whatsappId = `${cleanNumber}@c.us`;

      // Enviamos el mensaje usando el cliente de la librería
      await this.client.sendMessage(whatsappId, body);

      this.logger.log(`Mensaje enviado con éxito a: ${whatsappId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error al enviar mensaje a ${to}:`, error);
      return false;
    }
  }
}
