import { IAppConfig } from '@/interfaces';

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Builds the typed config tree from environment variables. */
export default (): IAppConfig => ({
  port: toInt(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: toInt(process.env.DATABASE_PORT, 5434),
    user: process.env.DATABASE_USER ?? 'review',
    password: process.env.DATABASE_PASSWORD ?? 'review',
    name: process.env.DATABASE_NAME ?? 'review_queue',
    synchronize: toBool(process.env.DB_SYNCHRONIZE, true),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'super-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  reservation: {
    ttlMinutes: toInt(process.env.RESERVATION_TTL_MINUTES, 1),
    reaperIntervalMs: toInt(process.env.REAPER_INTERVAL_MS, 15000),
  },
  cache: {
    ttlMs: toInt(process.env.CACHE_TTL_MS, 3000),
  },
  rateLimit: {
    max: toInt(process.env.RATE_LIMIT_MAX, 30),
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  },
  ingestion: {
    seedOnBoot: toBool(process.env.SEED_ON_BOOT, true),
    generateTickets: toBool(process.env.GENERATE_TICKETS, false),
    generateIntervalMs: toInt(process.env.GENERATE_INTERVAL_MS, 30000),
  },
});
