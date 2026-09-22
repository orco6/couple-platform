import type { Prisma } from '@/generated/prisma/client';
import type { DbClient } from './types';

/**
 * Run `work` atomically.
 *
 * If `client` is the root client, a new interactive transaction is opened. If it
 * is already a transaction client, `work` joins it — so services compose: an
 * outer service can call an inner one inside its own transaction and both
 * commit or roll back together.
 */
export async function inTransaction<T>(
  client: DbClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const root = client as { $transaction?: unknown };
  if (typeof root.$transaction === 'function') {
    return (client as { $transaction: (fn: typeof work, options?: object) => Promise<T> }).$transaction(work, {
      maxWait: 5_000,
      timeout: 15_000,
    });
  }
  return work(client as Prisma.TransactionClient);
}
