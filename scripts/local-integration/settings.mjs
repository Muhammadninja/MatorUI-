import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaults = JSON.parse(readFileSync(path.join(root, 'config/local-integration/services.json'), 'utf8'));
export const state = path.resolve(process.env.MATOR_INTEGRATION_DIR || path.join(root, '.local/integration'));
export const backendSource = path.resolve(process.env.MATOR_BACKEND_DIR || path.join(root, '../mator.uz/Backend'));
export const backend = path.join(state, 'backend');
export const database = defaults.database;
export const databaseUser = defaults.databaseUser;
export function port(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw Error(`Invalid ${name}`);
  return value;
}
export const ports = {
  api: port('MATOR_API_PORT', defaults.backendPort),
  postgres: port('MATOR_POSTGRES_PORT', defaults.postgresPort),
  redis: port('MATOR_REDIS_PORT', defaults.redisPort),
};
export const databaseUrl = `postgresql://${databaseUser}@127.0.0.1:${ports.postgres}/${database}?schema=public`;
// Child processes never inherit cloud credentials or the original backend .env.
export const cleanEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  LANG: 'en_US.UTF-8',
  NODE_ENV: 'development',
};

export function assertLocalEnvironment(env) {
  const url = new URL(env.DATABASE_URL || '');
  if (url.hostname !== '127.0.0.1' || url.pathname !== `/${database}` ||
      url.username !== databaseUser || url.port !== String(ports.postgres) ||
      env.DIRECT_URL !== env.DATABASE_URL || env.NODE_ENV !== 'development' ||
      env.AUTH_DEV_MODE !== 'true' || env.REDIS_HOST !== '127.0.0.1' ||
      env.REDIS_PORT !== String(ports.redis)) {
    throw Error('Refusing to operate outside the dedicated local integration environment');
  }
}
