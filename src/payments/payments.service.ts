import { Injectable, Logger } from '@nestjs/common';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { envs } from 'src/config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private mpClient: MercadoPagoConfig;

  constructor() {
    
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
          // URLs a las que MP redirigirá al cliente según el resultado.
          // Usan PUBLIC_URL (ngrok/dominio) y las rutas REALES del PaymentsController (/payments/...).
          back_urls: {
            success: `${envs.publicUrl}/payments/success?orderId=${orderId}`,
            failure: `${envs.publicUrl}/payments/failure?orderId=${orderId}`,
            pending: `${envs.publicUrl}/payments/pending?orderId=${orderId}`,
          },
          // Webhook asíncrono: MP avisa acá cuando el pago (incluido EFECTIVO) cambia de estado.
          notification_url: `${envs.publicUrl}/payments/webhook`,
          // 'auto_return' solo si PUBLIC_URL es una URL pública (no localhost): redirige solo al aprobar.
          ...(envs.publicUrl.startsWith('https')
            ? { auto_return: 'approved' as const }
            : {}),
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
 /**
   * Verifica el estado real del pago y actualiza el sistema en vivo
   */
 async processWebhookNotification(paymentId: string): Promise<string | null> {
  try {
    const paymentClient = new Payment(this.mpClient);
    const paymentData = await paymentClient.get({ id: paymentId });

    const orderId = paymentData.external_reference;
    const status = paymentData.status;

    this.logger.log(`🔍 Verificación de pago MP: Orden #${orderId} - Estado: ${status}`);

    if (status === 'approved') {
      this.logger.log(`💰 ¡CONFIRMADO! El pago de la orden #${orderId} fue acreditado.`);
      return orderId ?? null; // Devolvemos el id; el controller marca la orden
    }

    return null;
  } catch (error) {
    this.logger.error(`Error al procesar el pago del webhook ${paymentId}:`, error);
    return null;
  }
}


  
}
