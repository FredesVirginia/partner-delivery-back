import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { User } from '../../users/entity/user.entity';

/**
 * Registro de refresh tokens para soportar rotación y revocación (logout real).
 * Guardamos solo el HASH (argon2) del token, nunca el token en claro.
 */
@Entity('refresh_tokens')
export class RefreshToken extends AbstractEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'token_hash', type: 'varchar' })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}
