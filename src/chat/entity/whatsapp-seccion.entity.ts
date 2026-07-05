import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_seccion')
export class WhatsappSeccion {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'text' })
  data: string; // Aquí va el chorizo de texto con las credenciales que genera whatsapp-web.js

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
