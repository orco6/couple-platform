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

test('the week runs Sunday to Saturday and tells three figures, without a percentage', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);
  await page.goto('/week');

  await expect(page.getByRole('heading', { name: copy.week.pageTitle })).toBeVisible();

  const [from, to] = await rangeDates(page);
  expect(from.getUTCDay(), 'a week starts on Sunday').toBe(0);
  expect(to.getUTCDay(), 'a week ends on Saturday').toBe(6);

  // The list, as people say it: how many of how many. Not a percentage — the
  // week is told, not reported (third edition).
  await expect(page.getByText(/^\d+ מתוך \d+$/)).toBeVisible();
  await expect(page.getByText(/%/)).toHaveCount(0);

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
