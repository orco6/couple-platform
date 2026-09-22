import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a PRODUCTION BUILD (not `next dev`: first-request
 * compilation makes timings flaky and hides bundle problems) on a dedicated
 * database, bpf_e2e, rebuilt and seeded by e2e/global-setup.ts.
 *
 * Projects:
 *   desktop  every spec, 1440×900
 *   mobile   specs about mobile behaviour and shared components, Pixel 7
 *
 * One worker: specs share one database. No arbitrary waits — assertions retry.
 */

const PORT = Number(process.env.E2E_PORT ?? 3200);
const BASE_URL = `http://localhost:${PORT}`;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://bpf:bpf-local-only@127.0.0.1:5434/bpf_e2e';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  // CI retries once only to capture a second trace; a test that passes only on retry still fails
  // the run (failOnFlakyTests). Flaky tests are investigated to a cause, never retried away.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // E2E_DIAGNOSE=1 keeps a video of every failure (flake investigation); off by default to save CPU.
    video: process.env.E2E_DIAGNOSE ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(mobile|components|shell)\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    // E2E_DIAGNOSE=1 prints the server's own log lines (unexpected errors, slow requests) into the run output.
    stdout: process.env.E2E_DIAGNOSE ? 'pipe' : 'ignore',
    stderr: 'pipe',
    timeout: 400_000,
    env: {
      APP_ENV: 'test',
      DATABASE_URL: E2E_DATABASE_URL,
      DIRECT_URL: E2E_DATABASE_URL,
      LOG_LEVEL: process.env.E2E_DIAGNOSE ? 'info' : 'warn',
    },
  },
});
