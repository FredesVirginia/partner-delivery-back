import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { User } from '../../users/entity/user.entity';

/**
 * Un dispositivo suscripto a notificaciones. Un usuario puede tener varios
 * (el celular y la notebook), y cada navegador genera el suyo.
 
 */
@Entity('push_subscriptions')
export class PushSubscriptionEntity extends AbstractEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // URL única que el navegador nos da para empujarle notificaciones.

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @Column({ name: 'p256dh_key', type: 'varchar' })
  p256dh: string;

  @Column({ name: 'auth_key', type: 'varchar' })
  auth: string;
}
