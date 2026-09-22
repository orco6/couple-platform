import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Two projects:
 *   unit         pure functions, no database, run in parallel
 *   integration  real PostgreSQL (bpf_test), one file at a time, every test
 *                starts from empty tables (tests/support/database.ts)
 *
 * `server-only` is aliased to an empty module: it exists to stop server code
 * leaking into client bundles, which is not a concern in Node tests.
 */
const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  'server-only': fileURLToPath(new URL('./tests/support/empty-module.ts', import.meta.url)),
};

import { TEST_DATABASE_URL } from './tests/support/test-database';

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          env: { APP_ENV: 'test', TZ: 'UTC' },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/support/global-setup.ts'],
          setupFiles: ['tests/support/per-test.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
          env: {
            APP_ENV: 'test',
            TZ: 'UTC',
            DATABASE_URL: TEST_DATABASE_URL,
            DIRECT_URL: TEST_DATABASE_URL,
          },
        },
      },
    ],
  },
});
