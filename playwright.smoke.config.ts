import { defineConfig, devices } from '@playwright/test';

/**
 * DEPLOYED SMOKE TEST — runs against a URL that is already live.
 *
 *   SMOKE_BASE_URL=https://… REVIEW_PASSWORD_A=… REVIEW_PASSWORD_B=… npm run smoke
 *
 * Deliberately NOT extending playwright.config.ts: that one builds the app,
 * starts a server and rebuilds a local database from scratch. This one starts
 * nothing and owns nothing — it signs in to a deployment the way a reviewer
 * does, and the only rows it writes are its own.
 *
 * Deployment Protection stays ON. Vercel's documented automation bypass is the
 * way through it: put the project's VERCEL_AUTOMATION_BYPASS_SECRET in the
 * environment and every request carries the header, plus the one that asks
 * Vercel to set the bypass cookie so client-side navigations are covered too.
 *
 * Phone-sized, because that is the device the product is for and the one the
 * review will happen on.
 */

const BASE_URL = process.env.SMOKE_BASE_URL;
if (!BASE_URL) throw new Error('SMOKE_BASE_URL is required (the deployed origin to test).');

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './e2e/smoke',
  testMatch: /\.smoke\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(bypass
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': bypass,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
});
