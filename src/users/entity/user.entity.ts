import { Exclude } from 'class-transformer';
import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { UserRole } from '../enums/user-role.enum';

@Entity('users')
export class User extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  email: string;

  @Column({ name: 'user_name', type: 'varchar' })
  userName: string;

  @Column({ name: 'address', type: 'varchar' })
  address: string;

  @Column({ name: 'phone', type: 'varchar' })
  phone: string;

  @Column({ name: 'neighborhood', type: 'varchar', nullable: true })
  neighborhood: string;

  @Column({ name: 'location', type: 'varchar', nullable: true })
  location: string;

  // Nunca se expone en las respuestas (ClassSerializerInterceptor + @Exclude).
  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Permite invalidar tokens emitidos antes de un cambio de contraseña.
  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt: Date | null;
}
