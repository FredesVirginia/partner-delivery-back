import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrdersModule } from './orders/orders.module';
import { ChatModule } from './chat/chat.module';
import { PaymentsModule } from './payments/payments.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from './config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    OrdersModule,
    ChatModule,
    PaymentsModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: envs.dbHost,
      port: envs.port,
      username: envs.dbUser,
      password: envs.dbPassword,
      database: envs.dbName,
      autoLoadEntities: true,
      synchronize: true,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],

  controllers: [AppController],
  providers: [
    AppService,

    // Servicio adicional para verificar la conexión
    {
      provide: 'DATABASE_CONNECTION_LOGGER',
      useFactory: async () => {
        const logger = new Logger('Database');

        setTimeout(() => {
          logger.log(
            `🗄️  Conectado a PostgreSQL en: ${envs.dbHost}:${envs.port}/${envs.dbName}`,
          );
          logger.debug('✅ ¡Conexión exitosa!');
        }, 1000);
      },
    },
  ],
})
export class AppModule {}
