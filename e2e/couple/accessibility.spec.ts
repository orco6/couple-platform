/**
 * The couple's own screens, through axe (WCAG 2.1 A/AA). The core spec covers
 * the platform's pages; these are the four this product actually is, plus the
 * two states that only exist after a write — a card offering its stars, and a
 * revealed day — because both are built out of custom controls (a radiogroup
 * drawn as stars, a two-sided panel) and that is exactly where automated rules
 * earn their keep.
 *
 * Automated rules catch roughly a third of real problems. The keyboard and
 * screen-reader pass is in MANUAL_QA.md.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { copy } from '@/domain/copy';

import { apiLogin, login, uniqueName } from '../helpers';
import { addTask, completeTask, setReviewTime, taskCard, OWNER } from './helpers';

async function violations(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`);
}

test('the four couple screens have no WCAG A/AA violations', async ({ page }) => {
  await login(page, OWNER);
  for (const path of ['/', '/review', '/week', '/month', '/settings', '/archive']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await violations(page), path).toEqual([]);
  }
});

test('a task card offering its stars has no WCAG A/AA violations', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לשטוף כלים'), 'partner');
  await completeTask(page, title);

  // The state under test: a completed card with the rating radiogroup open.
  await expect(taskCard(page, title).getByRole('radio')).toHaveCount(5);
  expect(await violations(page)).toEqual([]);

  // And after rating, where the value is announced beside the stars.
  await taskCard(page, title).getByRole('radio').nth(3).click();
  await expect(taskCard(page, title).getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^4 —/);
  expect(await violations(page)).toEqual([]);
});

test('the day-closing form and its scale are reachable by keyboard alone', async ({ page, request, baseURL }) => {
  // Whatever hour the run happens at, the form has to be on the screen for
  // this test. The "too early" state has its own coverage in review.spec.ts.
  await apiLogin(request, baseURL!, OWNER);
  await setReviewTime(request, baseURL!, '00:00');

  await login(page, OWNER);
  await page.goto('/review');

  const stars = page.getByRole('radiogroup', { name: copy.day.respectLabel });

  // A radiogroup is one tab stop, moved through with the arrow keys — and the
  // focus has to travel with the choice, or the next Tab goes somewhere the
  // person did not ask for.
  await stars.getByRole('radio').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const checked = stars.getByRole('radio', { checked: true });
  await expect(checked).toHaveCount(1);
  await expect(checked).toHaveAttribute('aria-label', /^3 —/);
  await expect(checked).toBeFocused();
  await expect(checked).toHaveAttribute('tabindex', '0');

  // End and Home reach the two ends of the scale.
  await page.keyboard.press('End');
  await expect(stars.getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^5 —/);
  await page.keyboard.press('Home');
  await expect(stars.getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^1 —/);

  expect(await violations(page)).toEqual([]);
});
