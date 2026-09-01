import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  SERVICE_ROLE: z.enum(['all', 'api', 'realtime', 'worker']).default('all'),
  PORT: z.coerce.number().default(3000),
  REALTIME_PORT: z.coerce.number().default(3001),
  WORKER_HEALTH_PORT: z.coerce.number().default(3002),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DB_POOL_SIZE: z.coerce.number().default(10),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  ADMIN_SEED_EMAIL: z.string().default('admin@localhost'),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().default(''),
  STORAGE_ENDPOINT: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  APPLE_SHARED_SECRET: z.string().optional(),
  APPLE_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  USE_MOCK_PAYMENT: z.coerce.boolean().default(false),
  GRACE_PERIOD_DAYS: z.coerce.number().default(3),
  MIN_APP_VERSION: z.string().default('1.0.0'),
  IMAGE_TAG: z.string().default('local'),
  GIT_SHA: z.string().default('unknown'),
  AI_MAX_BATCH_SIZE: z.coerce.number().default(50),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

if (data.NODE_ENV === 'production') {
  if (data.USE_MOCK_PAYMENT) {
    console.error('FATAL: USE_MOCK_PAYMENT=true is not allowed in production');
    process.exit(1);
  }
  if (!data.APPLE_SHARED_SECRET && !data.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn('WARNING: No IAP verification credentials configured in production');
  }
  if (data.SERVICE_ROLE === 'all') {
    console.warn('WARNING: SERVICE_ROLE=all in production — use separate api/realtime/worker containers');
  }
}

export const config = {
  ...data,
  corsOrigins: data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  isProduction: data.NODE_ENV === 'production',
  isStaging: data.NODE_ENV === 'staging',
  isDevelopment: data.NODE_ENV === 'development',
  isTest: data.NODE_ENV === 'test',
};

export type AppConfig = typeof config;
