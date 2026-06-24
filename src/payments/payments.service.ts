import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { envs } from 'src/config';
import { OrderService } from 'src/orders/order.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private mpClient: MercadoPagoConfig;

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly ordersService: OrderService,
  ) {
    
    // Inicializamos el cliente oficial de Mercado Pago con el token de tu .env
    const accessToken = envs.mpAccessToken;

    if (!accessToken) {
      this.logger.error(
        '❌ MP_ACCESS_TOKEN no encontrado en las variables de entorno (.env)',
      );
    }

    this.mpClient = new MercadoPagoConfig({
      accessToken: accessToken || '',
      options: { timeout: 5000 },
    });
  }

  /**
   * Crea un link de pago (Preference) para una orden específica
   */
  async createDeliveryPreference(
    orderId: string | number,
    clientName: string,
    price: number,
  ): Promise<string> {
    try {
      this.logger.log(
        `Iniciando creación de preferencia para Orden #${orderId} por un monto de $${price}`,
      );

      const preference = new Preference(this.mpClient);

      // Creamos la configuración del pago
      const response = await preference.create({
        body: {
          items: [
            {
              id: orderId.toString(),
              title: `Servicio de Cadetería - Orden #${orderId}`,
              quantity: 1,
              unit_price: Number(price),
              currency_id: 'ARS', // Moneda nacional de Argentina 🇦🇷
            },
          ],
          // URLs a las que MP redirigirá al cliente según el resultado
          back_urls: {
            success: `http://localhost:3000/orders/payment/success?orderId=${orderId}`,
            failure: `http://localhost:3000/orders/payment/failure?orderId=${orderId}`,
            pending: `http://localhost:3000/orders/payment/pending?orderId=${orderId}`,
          },
          // OJO: 'auto_return' exige que back_urls.success sea una URL pública (no localhost).
          // Mientras probás en local lo dejamos comentado. Para producción (o con ngrok/https),
          // reactivá esta línea y poné una URL pública en back_urls.success.
          // auto_return: 'approved',
          external_reference: orderId.toString(), // Guardamos el ID de la orden para rastrearlo luego
        },
      });

      // El campo 'init_point' es la URL de producción/prueba real que el usuario tiene que abrir para pagar
      this.logger.log(
        `✅ Preferencia creada con éxito. Link generado: ${response.init_point}`,
      );
      return response.init_point!;
    } catch (error) {
      this.logger.error(
        `Error al crear la preferencia en Mercado Pago para la orden ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verifica el estado real del pago directamente con Mercado Pago
   */
  async processWebhookNotification(paymentId: string) {
    try {
      const paymentClient = new Payment(this.mpClient);
      
      // Buscamos los datos oficiales del pago en los servidores de MP
      const paymentData = await paymentClient.get({ id: paymentId });
      
      const orderId = paymentData.external_reference; // Te acordás que guardamos el orderId acá?
      const status = paymentData.status; // 'approved', 'pending', etc.

      console.log(`🔍 Verificación de pago MP: Orden #${orderId} - Estado: ${status}`);

      if (status === 'approved') {
        console.log(`💰 ¡CONFIRMADO! El pago de la orden #${orderId} fue acreditado.`);
        // TODO: Acá vamos a cambiar el estado de la orden a 'PAID' en Postgres
        // y avisar por sockets al front.
      }
    } catch (error) {
      console.error(`Error al procesar el pago del webhook ${paymentId}:`, error);
    }
  }
}
