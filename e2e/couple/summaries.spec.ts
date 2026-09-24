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


/**
 * The two dates of the range on screen. The label is written the way people
 * say it ("20-26 בספטמבר"), so the dates are read from the ISO attributes the
 * stepper carries alongside it, and the label is checked to be present.
 */
async function rangeDates(page: Page): Promise<[Date, Date]> {
  const range = page.locator('[data-range-from]').first();
  await expect(range).not.toBeEmpty();
  const iso = (value: string | null) => {
    const [year, month, day] = (value ?? '').split('-').map(Number);
    return new Date(Date.UTC(year!, month! - 1, day!));
  };
  return [iso(await range.getAttribute('data-range-from')), iso(await range.getAttribute('data-range-to'))];
}

test('each week is one card: Sunday to Saturday, its figures in words, seven days, one thought', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);
  await page.goto('/week');

  await expect(page.getByRole('heading', { level: 1, name: copy.week.overviewTitle })).toBeVisible();
  // This week leads, named as people say it.
  const thisWeek = page.getByRole('article', { name: copy.week.thisWeek });
  await expect(thisWeek).toBeVisible();

  const [from, to] = await rangeDates(page);
  expect(from.getUTCDay(), 'a week starts on Sunday').toBe(0);
  expect(to.getUTCDay(), 'a week ends on Saturday').toBe(6);

  // Every week card says how many of how many, never a percentage.
  await expect(page.getByText(/%/)).toHaveCount(0);

  // A card with tasks in it: the rating average (out of five, or "not yet"),
  // seven days in order, one thought for next week — and nothing about the
  // day closings or respect (taken off the summary on request).
  const cards = page.getByRole('article');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    if ((await card.getByRole('list', { name: copy.week.byDayTitle }).count()) === 0) continue;
    await expect(card.getByRole('list', { name: copy.week.byDayTitle }).getByRole('listitem')).toHaveCount(7);
    await expect(card.getByText(copy.week.ratingAverage, { exact: true })).toBeVisible();
    await expect(card.getByText(`${copy.week.insightTitle}:`)).toHaveCount(1);
  }
  await expect(page.getByText(copy.week.respectTitle)).toHaveCount(0);

  problems.assertClean();
});

test('the weeks run newest first, seven days apart, all on one page', async ({ page }) => {
  await login(page, OWNER);
  await page.goto('/week');

  const ranges = page.locator('[data-range-from]');
  const count = await ranges.count();
  expect(count).toBeGreaterThanOrEqual(1);
  let previous: number | null = null;
  for (let index = 0; index < count; index += 1) {
    const value = await ranges.nth(index).getAttribute('data-range-from');
    const [year, month, day] = (value ?? '').split('-').map(Number);
    const time = Date.UTC(year!, month! - 1, day!);
    if (previous !== null) expect((previous - time) % (7 * 86_400_000)).toBe(0);
    if (previous !== null) expect(time).toBeLessThan(previous);
    previous = time;
  }
});

test('the month is its weeks as lights, with no percentages or trend charts', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);
  await page.goto('/month');

  await expect(page.getByRole('heading', { name: copy.month.pageTitle })).toBeVisible();

  const [from, to] = await rangeDates(page);
  expect(from.getUTCDate(), 'a month starts on the 1st').toBe(1);
  expect(to.getUTCMonth()).toBe(from.getUTCMonth());

  // One row per week of the month, each labelled, between four and six of them.
  const weekRows = page.getByRole('list', { name: copy.month.weeklyAveragesTitle }).getByRole('listitem');
  const rows = await weekRows.count();
  expect(rows).toBeGreaterThanOrEqual(4);
  expect(rows).toBeLessThanOrEqual(6);

  await expect(weekRows.first()).toContainText(copy.month.weekLabel(1));

  // Direction is carried by the picture and one sentence; no dashboard.
  await expect(page.getByText(/%/)).toHaveCount(0);
  await expect(page.getByText(copy.month.completionTrendTitle)).toHaveCount(0);

  problems.assertClean();
});
