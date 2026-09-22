import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Screenshot sweep (npm run qa:screenshots). Same production build, database
 * and seed as the E2E suite; different job: produce images for design review.
 *
 *   desktop  Chromium 1440×900
 *   iphone   WebKit, iPhone 13 — Safari's engine, not a resized Chromium
 *            (`npx playwright install webkit` once)
 *
 * Output: screenshots/qa/<project>/ (gitignored). Not part of CI: it produces
 * artefacts for a reviewer rather than pass/fail signal about behaviour.
 */
export default defineConfig({
  ...base,
  testDir: './e2e/qa',
  testMatch: /\.qa\.ts$/,
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 13'],
        // Same escape hatch as playwright.config.ts: where WebKit cannot be
        // downloaded, fall back to Chromium at the iPhone's size and pixel
        // ratio. An approximation — Safari's own rendering still has to be
        // checked on a real machine (MANUAL_QA.md) — but better than no shots.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { defaultBrowserType: 'chromium' as const } : {}),
      },
    },
  ],
});
