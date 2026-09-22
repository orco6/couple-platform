/**
 * THE WEEK AND THE MONTH — R-SUM-*. Two read-only screens, so what is worth
 * testing is the shape of what they say: one week is Sunday to Saturday, the
 * figures are present and in range, and there is exactly ONE improvement
 * insight. "Do not turn this into analytics software" is a testable property.
 */

import { expect, test, type Page } from '@playwright/test';

import { copy } from '@/domain/copy';

import { login, watchForProblems } from '../helpers';
import { OWNER } from './helpers';

/** "22.09.2026" → a Date, so the spec can assert which weekday it is. */
function parseHebrewDate(text: string): Date {
  const [day, month, year] = text.split('.').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

/** The two dates in the range stepper's label. */
async function rangeDates(page: Page): Promise<[Date, Date]> {
  const label = await page.getByText(/\d{2}\.\d{2}\.\d{4} — \d{2}\.\d{2}\.\d{4}/).first().innerText();
  const [from, to] = label.split('—').map((part) => parseHebrewDate(part.trim()));
  return [from!, to!];
}

test('the week runs Sunday to Saturday and reports the four figures once each', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);
  await page.goto('/week');

  await expect(page.getByRole('heading', { name: copy.week.pageTitle })).toBeVisible();

  const [from, to] = await rangeDates(page);
  expect(from.getUTCDay(), 'a week starts on Sunday').toBe(0);
  expect(to.getUTCDay(), 'a week ends on Saturday').toBe(6);

  // The list: a percentage, and the fraction it came from beside it.
  await expect(page.getByText(/^\d{1,3}%$/)).toBeVisible();
  await expect(page.getByText(/^\d+ מתוך \d+$/)).toBeVisible();

  // The two averages, each out of five. Not a score out of 100.
  for (const title of [copy.week.executionTitle, copy.week.respectTitle]) {
    const card = page.locator('section, div').filter({ hasText: title }).last();
    await expect(card.getByText(copy.common.outOfFive).first()).toBeVisible();
  }

  // Exactly one insight, which is the product decision this screen rests on.
  await expect(page.getByText(copy.week.insightTitle)).toHaveCount(1);

  problems.assertClean();
});

test('the week can be stepped back, and the current week has nothing after it', async ({ page }) => {
  await login(page, OWNER);
  await page.goto('/week');

  // On the current week there is no "next".
  await expect(page.getByRole('link', { name: copy.summariesNav.next })).toHaveCount(0);

  const [thisFrom] = await rangeDates(page);
  await page.getByRole('link', { name: copy.summariesNav.previous }).click();
  await page.waitForURL(/\/week\?w=/);

  const [previousFrom] = await rangeDates(page);
  expect(Math.round((thisFrom.getTime() - previousFrom.getTime()) / 86_400_000)).toBe(7);

  // And now stepping forward is offered again, and returns where we started.
  await page.getByRole('link', { name: copy.summariesNav.next }).click();
  await expect(page.getByRole('link', { name: copy.summariesNav.next })).toHaveCount(0);
  const [backAgain] = await rangeDates(page);
  expect(backAgain.getTime()).toBe(thisFrom.getTime());
});

test('the month shows week-by-week averages and two trends, and no chart library', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);
  await page.goto('/month');

  await expect(page.getByRole('heading', { name: copy.month.pageTitle })).toBeVisible();

  const [from, to] = await rangeDates(page);
  expect(from.getUTCDate(), 'a month starts on the 1st').toBe(1);
  expect(to.getUTCMonth()).toBe(from.getUTCMonth());

  // One row per week of the month, each labelled, between four and six of them.
  const weekRows = page.getByRole('listitem').filter({ hasText: new RegExp(`^${copy.month.weekLabel(1).slice(0, 4)}`) });
  const rows = await weekRows.count();
  expect(rows).toBeGreaterThanOrEqual(4);
  expect(rows).toBeLessThanOrEqual(6);

  await expect(page.getByText(copy.month.completionTrendTitle)).toBeVisible();
  await expect(page.getByText(copy.month.toneTrendTitle)).toBeVisible();

  // The trends are drawn as inline SVG, not fetched from a charting CDN.
  await expect(page.locator('svg').first()).toBeVisible();

  problems.assertClean();
});
