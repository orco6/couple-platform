/**
 * Prisma client factory.
 *
 * Separate from `client.ts` so scripts and tests can build their own client for
 * an explicit URL without importing the app's `server-only` singleton.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

export function createPrismaClient(connectionString: string, options: { log?: boolean } = {}) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: options.log ? ['warn', 'error'] : ['error'],
  });
}

export type Database = ReturnType<typeof createPrismaClient>;
