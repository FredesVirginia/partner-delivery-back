import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { describeError } from '../common/utils/error.util';
import { envs } from '../config';
import { User } from '../users/entity/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { SubscribeDto } from './dtos/push-subscription.dto';
import { PushSubscriptionEntity } from './entity/push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

const GONE_STATUS_CODES = [404, 410];

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly subscriptionRepository: Repository<PushSubscriptionEntity>,
  ) {}

  onModuleInit(): void {
    const { vapidPublicKey, vapidPrivateKey, vapidSubject } = envs;

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      this.logger.warn(
        'Web Push deshabilitado: faltan VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT.',
      );
      return;
    }

    try {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.enabled = true;
      this.logger.log('Web Push habilitado. 🔔');
    } catch (error) {
      const { message } = describeError(error);
      this.logger.error(
        `Web Push deshabilitado por configuración inválida: ${message}`,
      );
      this.logger.error(
        'VAPID_SUBJECT tiene que ser "mailto:tu@mail.com" o una URL https://',
      );
    }
  }

  getPublicKey(): string | null {
    return this.enabled ? (envs.vapidPublicKey ?? null) : null;
  }

  async subscribe(userId: string, dto: SubscribeDto): Promise<{ id: string }> {
    const existing = await this.subscriptionRepository.findOne({
      where: { endpoint: dto.endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      const updated = await this.subscriptionRepository.save(existing);
      this.logger.log(`Suscripción actualizada para el usuario ${userId}`);
      return { id: updated.id };
    }

    const created = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      }),
    );

    this.logger.log(`Suscripción nueva para el usuario ${userId}`);
    return { id: created.id };
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptionRepository.delete({ userId, endpoint });
    this.logger.log(`Suscripción eliminada para el usuario ${userId}`);
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subscriptions = await this.subscriptionRepository.find({
      where: { userId },
    });

    await this.dispatch(subscriptions, payload);
  }

  async sendToAdmins(payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subscriptions = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .innerJoin(User, 'user', 'user.id = sub.userId')
      .where('user.role = :role', { role: UserRole.ADMIN })
      .andWhere('user.isActive = true')
      .getMany();

    await this.dispatch(subscriptions, payload);
  }

  private async dispatch(
    subscriptions: PushSubscriptionEntity[],
    payload: PushPayload,
  ): Promise<void> {
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    const goneIds: string[] = [];

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            body,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;

          if (statusCode && GONE_STATUS_CODES.includes(statusCode)) {
            goneIds.push(subscription.id);
            return;
          }

          const { message } = describeError(error);
          this.logger.warn(
            `No se pudo notificar la suscripción ${subscription.id}: ${message}`,
          );
        }
      }),
    );

    if (goneIds.length > 0) {
      await this.subscriptionRepository.delete(goneIds);
      this.logger.log(
        `${goneIds.length} suscripción(es) vencida(s) eliminadas.`,
      );
    }
  }

  //TODO FUNCION A INTEGRAR (DUDU)
  async sendTest(
    userId: string,
  ): Promise<{ enabled: boolean; devices: number }> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { userId },
    });

    if (this.enabled) {
      await this.dispatch(subscriptions, {
        title: 'Push de prueba 🔔',
        body: 'Si ves esto, las notificaciones funcionan.',
        url: '/',
        tag: 'test',
      });
    }

    return { enabled: this.enabled, devices: subscriptions.length };
  }
}
