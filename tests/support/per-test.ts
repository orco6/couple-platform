/**
 * Runs around every integration test.
 *
 * DETERMINISM (a Koma lesson): settings, throttle counters, sessions and every
 * other row are global state. A test that changes a setting must not change the
 * next test's result, and no test may depend on running after another. So every
 * test starts from EMPTY tables — truncated dynamically from pg_tables, so a new
 * table can never be forgotten in a hand-maintained list.
 */

import { afterAll, beforeEach } from 'vitest';
import { assertSafeForDestructiveOperation } from '@/core/db/safety';
import { db } from '@/core/db/client';

beforeEach(async () => {
  assertSafeForDestructiveOperation('test-reset', process.env.DATABASE_URL, process.env);
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await db.$disconnect();
});
