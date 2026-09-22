import 'server-only';

import { getEnv } from '@/core/env/env';
import { log } from '@/core/log';
import { createPrismaClient, type Database } from './create-client';
import { describeDatabaseUrl } from './safety';

/**
 * The application's database client. One per process.
 *
 * Created lazily so that `next build` (which imports modules but serves no
 * requests) does not require a DATABASE_URL, and cached on globalThis so dev
 * hot-reload does not open a new pool on every edit.
 */

const globalForDb = globalThis as unknown as { __db?: Database };

function getClient(): Database {
  if (!globalForDb.__db) {
    const env = getEnv();
    if (env.APP_ENV === 'development' && describeDatabaseUrl(env.DATABASE_URL).looksManaged) {
      // Allowed (sometimes deliberate), but never silent: a local dev server writing to a hosted database
      // is how test data ends up in front of a real business.
      log.warn('db.development_server_using_managed_database', { host: describeDatabaseUrl(env.DATABASE_URL).host });
    }
    globalForDb.__db = createPrismaClient(env.DATABASE_URL, { log: env.APP_ENV === 'development' });
  }
  return globalForDb.__db;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const client = getClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
