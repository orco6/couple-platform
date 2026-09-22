/**
 * Rebuild and seed the E2E database before the suite. Guarded: local host and a
 * database name ending in _e2e only. The URL is pinned before any helper that
 * loads .env is imported (see tests/support/global-setup.ts for why).
 */
import { assertSafeForDestructiveOperation } from '../src/core/db/safety';

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? 'postgresql://bpf:bpf-local-only@127.0.0.1:5434/bpf_e2e';
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  assertSafeForDestructiveOperation('e2e-reset', url, process.env);
  const { rebuildSchema } = await import('../scripts/lib/database');
  const { seedDevData } = await import('../scripts/lib/fixtures');
  await rebuildSchema(url);
  await seedDevData(url, 'realistic');
}
