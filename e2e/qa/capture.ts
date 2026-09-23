/**
 * The screenshot sweep's shared tools: numbered shots, and the watch that
 * fails a sweep on a console error or a sideways scroll.
 *
 * A module rather than part of sweep.qa.ts because Playwright refuses to let
 * one test file import another — and both sweep files need these.
 */

import { test, type Page } from '@playwright/test';

let counter = 0;

/** Restarts the NN- prefix. Each sweep file numbers its own shots from 01. */
export function resetCounter() {
  counter = 0;
}

export async function capture(page: Page, name: string, problems: string[], options: { fullPage?: boolean } = {}) {
  await page.waitForLoadState('networkidle').catch(() => {});
  // Let route settle (180ms) and overlay entrances (≤340ms) finish.
  await page.waitForTimeout(500);
  counter += 1;
  const project = test.info().project.name;
  const file = `screenshots/qa/${project}/${String(counter).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: options.fullPage ?? true }).catch(async () => {
    await page.screenshot({ path: file });
  });
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (scrollWidth > clientWidth + 1) problems.push(`${name}: scrolls sideways (${scrollWidth} > ${clientWidth})`);
}

export function watch(page: Page, problems: string[]) {
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 4\d\d/.test(message.text())) problems.push(`console: ${message.text().slice(0, 160)}`);
  });
  page.on('pageerror', (error) => {
    // WebKit reports a Next.js route prefetch (?_rsc=) that was cancelled because the sweep
    // navigated away as 'due to access control checks'. Verified: the requests fail with
    // 'Load request cancelled', nothing functional breaks. Anything else still fails the sweep.
    if (/[?&]_rsc=.*access control checks/.test(error.message)) return;
    problems.push(`pageerror: ${error.message.slice(0, 160)}`);
  });
}

