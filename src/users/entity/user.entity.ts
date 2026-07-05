import { Exclude } from 'class-transformer';
import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { UserRole } from '../enums/user-role.enum';

@Entity('users')
export class User extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  email: string;

  @Column({ name: 'first_name', type: 'varchar' })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar' })
  lastName: string;

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
