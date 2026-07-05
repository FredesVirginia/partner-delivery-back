import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidad base abstracta con las columnas comunes a (casi) todas las tablas.
 * Se llama AbstractEntity (y no BaseEntity) para no chocar con el BaseEntity
 * ActiveRecord de TypeORM. Cada entidad hace `extends AbstractEntity` y solo
 * declara sus columnas propias; el id y los timestamps se heredan de acá.
 */
export abstract class AbstractEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
