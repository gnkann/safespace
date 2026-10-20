export interface AppConfig {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  encryptionKey: string;
  bcryptRounds: number;
  paymentTimeoutMin: number;
  reminderBeforeHours: number;
  paymentProvider: 'fake' | 'stripe';
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  emailProvider: 'console' | 'sendgrid';
  sendgridApiKey: string;
  corsOrigin: string;
  adminEmail?: string;
  adminPassword?: string;
}

const DEV_JWT = 'dev-only-secret-dev-only-secret-0000';
const DEV_KEY = '00'.repeat(32);

/** Читає конфігурацію з env. У production небезпечні значення за замовчуванням заборонені (NFR-03). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const prod = nodeEnv === 'production';

  const jwtSecret = env.JWT_SECRET ?? (prod ? '' : DEV_JWT);
  const encryptionKey = env.ENCRYPTION_KEY ?? (prod ? '' : DEV_KEY);
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET має містити щонайменше 32 символи');
  if (prod && (jwtSecret === DEV_JWT || /^0+$/.test(encryptionKey))) {
    throw new Error('У production заборонено використовувати тестові ключі');
  }

  return {
    nodeEnv,
    port: Number(env.PORT ?? 4000),
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '1h',
    encryptionKey,
    bcryptRounds: Number(env.BCRYPT_ROUNDS ?? 10),
    paymentTimeoutMin: Number(env.SESSION_PAYMENT_TIMEOUT_MIN ?? 15),
    reminderBeforeHours: Number(env.REMINDER_BEFORE_HOURS ?? 24),
    paymentProvider: env.PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'fake',
    stripeSecretKey: env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    emailProvider: env.EMAIL_PROVIDER === 'sendgrid' ? 'sendgrid' : 'console',
    sendgridApiKey: env.SENDGRID_API_KEY ?? '',
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    adminEmail: env.ADMIN_EMAIL,
    adminPassword: env.ADMIN_PASSWORD,
  };
}
