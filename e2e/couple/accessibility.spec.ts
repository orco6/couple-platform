/**
 * The couple's own screens, through axe (WCAG 2.1 A/AA). The core spec covers
 * the platform's pages; these are the four this product actually is, plus the
 * two states that only exist after a write — a card offering a rating, and a
 * revealed day — because both are built out of custom controls (a slider drawn
 * as a light on a scale, a two-sided panel) and that is exactly where automated
 * rules earn their keep.
 *
 * Automated rules catch roughly a third of real problems. The keyboard and
 * screen-reader pass is in MANUAL_QA.md.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { copy } from '@/domain/copy';

import { apiLogin, login, uniqueName } from '../helpers';
import { addTask, completeTask, dragSlider, rateSheetSettled, setReviewTime, taskCard, OWNER } from './helpers';

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

test('the same screens hold up in dark mode', async ({ page }) => {
  // Contrast is the failure that ships: a scheme flips the surface and a text
  // colour somewhere does not flip with it. The light pass above cannot see it,
  // and neither can a reviewer who never changes their system setting.
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page, OWNER);

  for (const path of ['/', '/review', '/week', '/month', '/settings', '/archive']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await violations(page), `${path} (dark)`).toEqual([]);
  }
});

test('a task card offering a rating, and the rating sheet, have no WCAG A/AA violations', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לשטוף כלים'), 'partner');
  await completeTask(page, title);

  // A completed card inviting a rating.
  const invite = taskCard(page, title).getByRole('button', { name: copy.taskRating.prompt });
  await expect(invite).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // The sheet it opens, with its slider.
  await invite.click();
  const sheet = await rateSheetSettled(page);
  const slider = sheet.getByRole('slider', { name: copy.taskRating.prompt });
  await expect(slider).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // And after rating, where the word stands in the row.
  await dragSlider(page, slider, 4);
  await expect(sheet).toBeHidden();
  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[4]) })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the day-closing form and its scale are reachable by keyboard alone', async ({ page, request, baseURL }) => {
  // Whatever hour the run happens at, the form has to be on the screen for
  // this test. The "too early" state has its own coverage in review.spec.ts.
  await apiLogin(request, baseURL!, OWNER);
  await setReviewTime(request, baseURL!, '00:00');

  await login(page, OWNER);
  await page.goto('/review');

  const scale = page.getByRole('slider', { name: copy.day.respectLabel });

  // A real range input under the drawn light: one tab stop, and the keys a
  // keyboard (and VoiceOver's swipe up/down) already know.
  await scale.focus();
  await expect(scale).toBeFocused();
  await expect(scale).toHaveAttribute('aria-valuetext', copy.taskRating.hint);

  // End and Home reach the two ends of the scale, and each value is named.
  await page.keyboard.press('End');
  await expect(scale).toHaveAttribute('aria-valuetext', `5 — ${copy.day.scale[5]}`);
  await page.keyboard.press('Home');
  await expect(scale).toHaveAttribute('aria-valuetext', `1 — ${copy.day.scale[1]}`);

  // Tab moves on to the note: the scale did not trap focus.
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(copy.day.noteLabel)).toBeFocused();

  expect(await violations(page)).toEqual([]);
});
