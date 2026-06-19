/**
 * Typed view of all environment configuration. Keeping it in one place makes
 * the knobs (TTLs, intervals, limits) easy to discover and override per env.
 */
export interface IAppConfig {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    synchronize: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  reservation: {
    ttlMinutes: number;
    reaperIntervalMs: number;
  };
  cache: {
    ttlMs: number;
  };
  rateLimit: {
    max: number;
    windowMs: number;
  };
  ingestion: {
    seedOnBoot: boolean;
    generateTickets: boolean;
    generateIntervalMs: number;
  };
}
