import {
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Response, Request } from 'express';
import { OrderService } from '../orders/order.service';
import { accessPublic } from '../auth/decorators/public.decorator';

interface MercadoPagoWebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string };
  resource?: string;
}

// Todas estas rutas las consume Mercado Pago o el cliente sin sesión propia,
// así que quedan públicas frente al guard global de auth.
@accessPublic()
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * 1. Redirección cuando el pago es EXITOSO
   * Mercado Pago manda al cliente acá cuando toca "Volver al sitio"
   */
  @Get('success')
  handleSuccess(@Query('orderId') orderId: string, @Res() res: Response) {
    // Acá en el futuro redirigimos a la pantalla del cliente con un diseño lindo
    return res.status(HttpStatus.OK).send(`
      <h1>¡Pago Aprobado! 🎉</h1>
      <p>Tu pago para la orden #${orderId} se procesó con éxito. Podés cerrar esta pestaña y volver al chat.</p>
    `);
  }

  /**
   * 1b. Redirección cuando el pago queda PENDIENTE (ej: efectivo / cupón Pago Fácil)
   */
  @Get('pending')
  handlePending(@Query('orderId') orderId: string, @Res() res: Response) {
    return res.status(HttpStatus.OK).send(`
      <h1>Pago pendiente ⏳</h1>
      <p>Generamos el cupón para la orden #${orderId}. Cuando lo pagues en el local, se confirma solo. Podés cerrar esta pestaña.</p>
    `);
  }

  /**
   * 1c. Redirección cuando el pago FALLA o se rechaza
   */
  @Get('failure')
  handleFailure(@Query('orderId') orderId: string, @Res() res: Response) {
    return res.status(HttpStatus.OK).send(`
      <h1>El pago no se pudo completar ❌</h1>
      <p>Hubo un problema con el pago de la orden #${orderId}. Podés volver al chat e intentar de nuevo.</p>
    `);
  }

  /**
   * 2. El Webhook (Notificación Polling / IPN)
   * ¡Este es el importante! Mercado Pago le pega a este POST de forma asíncrona
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Query('topic') topic: string,
    @Res() res: Response,
  ) {
    const body = req.body as MercadoPagoWebhookBody;

    // Mercado Pago avisa de muchos eventos, a nosotros nos interesa "payment"
    if (topic === 'payment' || body?.type === 'payment') {
      const paymentId = body.data?.id ?? body.resource?.split('/').pop();

      if (paymentId) {
        this.logger.log(
          `📡 WEBHOOK RECIBIDO: Nuevo evento de pago con ID: ${paymentId}`,
        );

        // Llamamos a un método en el servicio para verificar el estado real de la plata
        const orderId =
          await this.paymentsService.processWebhookNotification(paymentId);
        if (orderId) {
          // MP devuelve el external_reference como texto; la orden usa id numérico.
          await this.orderService.markAsPaid(Number(orderId)); // Órdenes actualiza + emite el socket 'order_paid'
        }
      } else {
        this.logger.warn(
          'Webhook de pago recibido sin un ID identificable; se ignora.',
        );
      }
    }

    // SIEMPRE le respondemos un 200 OK a Mercado Pago para que sepa que recibimos el aviso
    return res.status(HttpStatus.OK).send('OK');
  }
}
