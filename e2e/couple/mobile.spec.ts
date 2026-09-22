/**
 * THE PHONE. This product is a phone product — the desktop layout is the
 * accommodation, not the target — so the four destinations, the thumb reach
 * and the tactile parts of completing and rating a task are tested at phone
 * width, on the shared list itself.
 *
 * `mobile.spec.ts` is matched by the mobile project (Pixel 7); the desktop
 * project runs it too, where it has nothing to say.
 */

import { expect, test } from '@playwright/test';

import { copy } from '@/domain/copy';

import { expectNoHorizontalOverflow, login, uniqueName, watchForProblems } from '../helpers';
import { addTask, completeTask, taskCard, OWNER } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'phone layout only');

test('the four destinations are one thumb-tap apart, and each one arrives', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);

  const bar = page.locator('[data-mobile-tab-bar]');
  await expect(bar).toBeVisible();

  const destinations = [
    { label: copy.nav.review, url: /\/review$/, heading: copy.day.pageTitle },
    { label: copy.nav.week, url: /\/week$/, heading: copy.week.pageTitle },
    { label: copy.nav.month, url: /\/month$/, heading: copy.month.pageTitle },
    { label: copy.nav.today, url: /\/$/, heading: copy.tasks.pageTitle },
  ];

  for (const destination of destinations) {
    await bar.getByRole('link', { name: destination.label }).click();
    await page.waitForURL(destination.url);
    await expect(page.getByRole('heading', { level: 1, name: destination.heading })).toBeVisible();
    // The bar marks where we are, for a screen reader as well as for the eye.
    await expect(bar.locator('[aria-current="page"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  }

  problems.assertClean();
});

test('every tap target on a task card is big enough for a thumb', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לקפל כביסה'), 'partner');
  await completeTask(page, title);

  const card = taskCard(page, title);
  // The completion mark, the card body, and the five stars.
  const targets = card.getByRole('button').or(card.getByRole('radio'));
  const count = await targets.count();
  expect(count).toBeGreaterThan(5);

  for (let index = 0; index < count; index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box, `target ${index} has no box`).not.toBeNull();
    // 40px is the floor this product set for the star row; nothing may be
    // smaller than that on a surface people use one-handed, at night.
    expect(Math.min(box!.width, box!.height), `target ${index}`).toBeGreaterThanOrEqual(40);
  }
});

test('the whole flow fits the phone: add, complete, rate', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);

  const title = await addTask(page, uniqueName('להוציא את הזבל'), 'partner');
  await expectNoHorizontalOverflow(page);

  await completeTask(page, title);
  await taskCard(page, title).getByRole('radio').nth(4).click();
  await expect(taskCard(page, title).getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^5 —/);
  await expectNoHorizontalOverflow(page);

  problems.assertClean();
});
