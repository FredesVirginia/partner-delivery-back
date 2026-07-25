import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  CORS_ORIGINS?: string;
  DB_HOST: string;
  DB_PORT: number;
  MP_ACCESS_TOKEN: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  PUBLIC_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  OPERATOR_PHONE: string;
  WA_DISABLED: boolean;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

const envsShema = joi
  .object<EnvVars>({
    DB_HOST: joi.string().required(),
    DB_PORT: joi.number().required(),
    DB_USER: joi.string().required(),
    DB_PASSWORD: joi.string().required(),
    DB_NAME: joi.string().required(),
    MP_ACCESS_TOKEN: joi.string().required(),
    // URL pública (ngrok / dominio) para back_urls y webhook de Mercado Pago.
    // Opcional: si no está, usa localhost (sirve para probar SIN pago real).
    PUBLIC_URL: joi.string().uri().optional(),
    // Secretos y tiempos de vida de los JWT (auth).
    JWT_ACCESS_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    JWT_ACCESS_TTL: joi.string().default('15m'),
    JWT_REFRESH_TTL: joi.string().default('7d'),
    CORS_ORIGINS: joi.string().optional(),
    // Teléfono de la operadora que recibe los pedidos (sin '+' ni guiones).
    OPERATOR_PHONE: joi.string().required(),
    // true = arranca sin el bot de WhatsApp (sin Puppeteer ni QR).
    WA_DISABLED: joi.boolean().default(false),
    // Web Push (PWA). Opcionales: sin ellas la app arranca igual, solo que
    // no manda notificaciones.
    VAPID_PUBLIC_KEY: joi.string().optional(),
    VAPID_PRIVATE_KEY: joi.string().optional(),
    VAPID_SUBJECT: joi.string().optional(),
  })
  .unknown(true);

// No destructuramos: `validate` devuelve una unión (o hay error, o hay value).
// Chequeando `result.error` primero, TypeScript sabe que `result.value` es EnvVars.
const result = envsShema.validate({
  ...process.env,
});

if (result.error) {
  throw new Error(`Config validation errors ${result.error.message}`);
}

const envVars = result.value;

export const envs = {
  port: envVars.DB_PORT,
  dbHost: envVars.DB_HOST,
  dbName: envVars.DB_NAME,
  dbPassword: envVars.DB_PASSWORD,
  dbUser: envVars.DB_USER,
  mpAccessToken: envVars.MP_ACCESS_TOKEN,
  publicUrl: envVars.PUBLIC_URL || 'http://localhost:3000',
  jwtAccessSecret: envVars.JWT_ACCESS_SECRET,
  jwtRefreshSecret: envVars.JWT_REFRESH_SECRET,
  jwtAccessTtl: envVars.JWT_ACCESS_TTL,
  jwtRefreshTtl: envVars.JWT_REFRESH_TTL,
  corsOrigins:
    envVars.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [],
  waDisabled: envVars.WA_DISABLED,
  operatorPhone: envVars.OPERATOR_PHONE,
  vapidPublicKey: envVars.VAPID_PUBLIC_KEY,
  vapidPrivateKey: envVars.VAPID_PRIVATE_KEY,
  vapidSubject: envVars.VAPID_SUBJECT,
};
