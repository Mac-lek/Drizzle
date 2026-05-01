import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().uri().required(),
  PROCESS_TYPE: Joi.string().valid('web', 'worker').default('web'),

  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),

  REDIS_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  PAYSTACK_SECRET_KEY: Joi.string().required(),
  PAYSTACK_PUBLIC_KEY: Joi.string().required(),
  PAYSTACK_WEBHOOK_URL: Joi.string().uri().required(),
  PAYSTACK_PREFERRED_BANK: Joi.string().default('wema-bank'),

  DOJAH_APP_ID: Joi.string().required(),
  DOJAH_PUBLIC_KEY: Joi.string().required(),
  DOJAH_SECRET_KEY: Joi.string().required(),
  DOJAH_BASE_URL: Joi.string().uri().default('https://api.dojah.io'),

  SMILE_PARTNER_ID: Joi.string().required(),
  SMILE_API_KEY: Joi.string().required(),
  SMILE_CALLBACK_URL: Joi.string().uri().required(),

  TERMII_API_KEY: Joi.string().required(),
  TERMII_SENDER_ID: Joi.string().default('Drizzle'),
  TERMII_BASE_URL: Joi.string().uri().default('https://api.ng.termii.com'),

  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().required(),
  MAIL_PASS: Joi.string().required(),
  MAIL_FROM: Joi.string().email().required(),

  FCM_SERVICE_ACCOUNT_JSON: Joi.string().required(),

  SENTRY_DSN: Joi.string().uri().optional(),

  BVN_ENCRYPTION_KEY_ID: Joi.string().required(),
});
