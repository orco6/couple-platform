/**
 * Integration suite setup: rebuild the TEST database from the migration
 * history before any test runs.
 *
 * Global setup does NOT receive the project's `test.env`, and the script
 * helpers load `.env` (the development database). So the test URL is pinned
 * here explicitly, BEFORE those helpers are imported — dotenv never overrides a
 * variable that is already set. The guard then refuses anything that is not a
 * local *_test database, checking both variables Prisma reads. (This exact
 * fall-through to the dev database was caught by the guard while this file was
 * being written.)
 *
 * Replaying real migrations here is also how a broken migration fails in CI
 * instead of in production.
 */

import { assertSafeForDestructiveOperation } from '../../src/core/db/safety';
import { TEST_DATABASE_URL } from './test-database';

export default async function setup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DIRECT_URL = TEST_DATABASE_URL;
  assertSafeForDestructiveOperation('test-reset', process.env.DATABASE_URL, process.env);
  assertSafeForDestructiveOperation('test-reset', process.env.DIRECT_URL, process.env);

  const { rebuildSchema } = await import('../../scripts/lib/database');
  await rebuildSchema(TEST_DATABASE_URL);
}
