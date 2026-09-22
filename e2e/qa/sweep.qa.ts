/**
 * SCREENSHOT SWEEP — not a test of behaviour. Puts every screen and the key
 * states in front of a reviewer (person or AI) at desktop and iPhone size, so
 * design judgement is made against the render, not the source.
 *
 *   npm run qa:screenshots            → screenshots/qa/<desktop|iphone>/NN-name.png
 *
 * Domain-agnostic: pages come from the rendered navigation, so it covers a new
 * business without edits. Per screen it also fails on console errors and on
 * sideways scrolling. Add business-specific states (a dialog open, a closed
 * month) in e2e/qa/<area>.qa.ts using the same `capture` helper.
 */

import { expect, test, type Page } from '@playwright/test';
import { CORE_USERS, login } from '../helpers';
import { capture, resetCounter, watch } from './capture';

async function navigationHrefs(page: Page, isMobile: boolean): Promise<string[]> {
  const hrefs = new Set<string>();
  const collect = async (scope: ReturnType<Page['locator']>) => {
    for (const href of await scope.locator('a[href^="/"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')!))) {
      hrefs.add(href);
    }
  };
  if (isMobile) {
    await collect(page.locator('[data-mobile-tab-bar]'));
    const more = page.locator('[data-mobile-tab-bar]').getByRole('button', { name: 'עוד' });
    if (await more.count()) {
      await more.click();
      await collect(page.getByTestId('mobile-more-sheet'));
      await page.keyboard.press('Escape');
    }
  } else {
    await collect(page.locator('aside[data-app-chrome] nav'));
  }
  return [...hrefs];
}

test('sweep: every screen and key state', async ({ page, isMobile }) => {
  test.setTimeout(6 * 60_000);
  const problems: string[] = [];
  watch(page, problems);
  resetCounter();

  await page.goto('/login');
  await capture(page, 'sign-in', problems);

  await login(page, CORE_USERS.top);
  const pages = await navigationHrefs(page, isMobile);

  for (const href of pages) {
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const slug = href === '/' ? 'home' : href.replace(/^\//, '').replace(/\//g, '-');
    await capture(page, slug, problems);

    // The first record behind a list: the detail screen.
    const firstRow = page.locator('main table tbody a[href^="/"], main ul a[href^="/"]').first();
    if (await firstRow.count()) {
      const detailHref = await firstRow.getAttribute('href');
      if (detailHref && detailHref !== href && !pages.includes(detailHref)) {
        await page.goto(detailHref);
        await capture(page, `${slug}-detail`, problems);
      }
    }

    // A filtered list with no results: the empty state people meet most often.
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const search = page.locator('main [role="search"] input[type="search"]');
    if (await search.count()) {
      await search.fill('זזזזזזזז');
      await page.waitForURL(/[?&]q=/);
      await capture(page, `${slug}-empty-search`, problems);
    }
  }

  if (isMobile) {
    await page.goto('/');
    await page.locator('[data-mobile-tab-bar]').getByRole('button', { name: 'עוד' }).click();
    await expect(page.getByTestId('mobile-more-sheet')).toBeVisible();
    await capture(page, 'more-sheet', problems, { fullPage: false });
    await page.keyboard.press('Escape');
  }

  await page.goto('/this-page-does-not-exist');
  await capture(page, 'not-found', problems);

  await page.goto('/design-system');
  await capture(page, 'gallery', problems);
  for (const [button, name] of [
    ['פתיחת דיאלוג', 'dialog'],
    ['דיאלוג עם תוכן ארוך', 'dialog-long'],
    ['פתיחת גיליון תחתון', 'bottom-sheet'],
    ['פתיחת אישור', 'confirm'],
  ] as const) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await capture(page, `gallery-${name}`, problems, { fullPage: false });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

  // What the least-privileged user sees first.
  await page.context().clearCookies();
  await login(page, CORE_USERS.unprivileged);
  await capture(page, 'home-least-privileged', problems);

  expect(problems, problems.join('\n')).toEqual([]);
});
