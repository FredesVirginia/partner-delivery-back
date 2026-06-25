import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  DB_HOST: string;
  DB_PORT: number;
  MP_ACCESS_TOKEN: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  PUBLIC_URL: string;
}

const envsShema = joi
  .object({
    DB_HOST: joi.string().required(),
    DB_PORT: joi.number().required(),
    DB_USER: joi.string().required(),
    DB_PASSWORD: joi.string().required(),
    DB_NAME: joi.string().required(),
    MP_ACCESS_TOKEN: joi.string().required(),
    // URL pública (ngrok / dominio) para back_urls y webhook de Mercado Pago.
    // Opcional: si no está, usa localhost (sirve para probar SIN pago real).
    PUBLIC_URL: joi.string().uri().optional(),
  })
  .unknown(true);

const { error, value } = envsShema.validate({
  ...process.env,
});

if (error) {
  throw new Error(`Config validation errors ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.DB_PORT,
  dbHost: envVars.DB_HOST,
  dbName: envVars.DB_NAME,
  dbPassword: envVars.DB_PASSWORD,
  dbUser: envVars.DB_USER,
  mpAccessToken: envVars.MP_ACCESS_TOKEN,
  publicUrl: envVars.PUBLIC_URL || 'http://localhost:3000',
};
