/**
 * SCREENSHOT SWEEP — the couple's own states.
 *
 * sweep.qa.ts already walks every page in the navigation. This file adds the
 * states that only exist after a write, or only at a particular hour, because
 * those are the ones design judgement actually turns on: a card mid-completion,
 * a card offering its stars, the day before it can be closed, the day after
 * both have closed. It also shoots the whole product in dark mode, which no
 * amount of reading the source will tell you about.
 *
 *   npm run qa:screenshots  → screenshots/qa/<desktop|iphone>/NN-name.png
 */

import { expect, test } from '@playwright/test';

import { copy } from '@/domain/copy';

import { apiLogin, login, uniqueName } from '../helpers';
import { addTask, completeTask, setReviewTime, taskCard, OWNER, PARTNER, dragSlider } from '../couple/helpers';
import { capture, resetCounter, watch } from './capture';

function daysAgo(n: number): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

/** The fixtures leave this day closed by both partners: the reveal. */
const REVEALED = () => daysAgo(2);
/** And this one closed by neither, so its form can be photographed any hour. */
const UNCLOSED = () => daysAgo(5);

test('couple: the cards, the stars and the reveal', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const problems: string[] = [];
  watch(page, problems);
  resetCounter();

  await login(page, OWNER);

  // ── The shared list, with a card in each of its three states ──────────
  const waiting = await addTask(page, uniqueName('להחליף נורה'), 'me');
  await completeTask(page, waiting);
  const toRate = await addTask(page, uniqueName('לאסוף חבילה'), 'partner');
  await completeTask(page, toRate);

  await page.goto('/');
  const invite = taskCard(page, toRate).getByRole('button', { name: copy.taskRating.prompt });
  await expect(invite).toBeVisible();
  await capture(page, 'today-open-waiting-and-to-rate', problems);

  // The rating sheet, then one drag to the fourth stop: the signature interaction.
  await invite.click();
  const sheet = page.getByTestId('rate-sheet');
  const slider = sheet.getByRole('slider');
  await expect(slider).toBeVisible();
  await page.waitForTimeout(500);
  await capture(page, 'rate-sheet', problems, { fullPage: false });
  await dragSlider(page, slider, 4);
  await expect(sheet).toBeHidden();
  await expect(taskCard(page, toRate).getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[4]) })).toBeVisible();
  await capture(page, 'today-just-rated', problems);

  // ── Adding a task ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: copy.tasks.addAction }).first().click();
  await expect(page.getByTestId('composer')).toBeVisible();
  await page.waitForTimeout(400);
  await capture(page, 'composer', problems, { fullPage: false });
  await page.getByRole('button', { name: copy.tasks.chooseDate }).click();
  await expect(page.getByTestId('calendar')).toBeVisible();
  await capture(page, 'composer-calendar', problems, { fullPage: false });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // ── The closing form, on a day nobody closed ──────────────────────────
  // A past date, so the shot does not depend on the hour the sweep runs at,
  // and nothing here submits: these two are the form, not the flow.
  await page.goto(`/review?date=${UNCLOSED()}`);
  await capture(page, 'review-empty-form', problems);

  await page.getByRole('slider', { name: copy.day.respectLabel }).fill('5');
  await page.getByLabel(copy.day.noteLabel).fill('יום טוב. הספקנו הכל ועוד יצאנו לקפה.');
  await capture(page, 'review-answered', problems);

  // ── The reveal, on a day the fixtures left closed by both ─────────────
  await page.goto(`/review?date=${REVEALED()}`);
  await expect(page.getByText(copy.day.revealedTitle)).toBeVisible();
  await capture(page, 'review-revealed', problems);

  // ── The same list, seen by the other partner ──────────────────────────
  await page.context().clearCookies();
  await login(page, PARTNER);
  await page.goto('/');
  await capture(page, 'today-other-partner', problems);

  expect(problems, problems.join('\n')).toEqual([]);
});

/**
 * The evening itself, which can only be photographed once: closing today is a
 * write that cannot be undone, so this runs in one project rather than leaving
 * the second one to find the day already closed.
 */
test('couple: closing today, from too-early to waiting', async ({ page, request, baseURL }) => {
  test.skip(test.info().project.name !== 'desktop', 'today can only be closed once');
  test.setTimeout(6 * 60_000);
  const problems: string[] = [];
  watch(page, problems);
  resetCounter();

  await apiLogin(request, baseURL!, OWNER);
  await setReviewTime(request, baseURL!, '23:59');

  await login(page, OWNER);
  await page.goto('/review');
  await expect(page.getByText(copy.day.notOpenYetTitle)).toBeVisible();
  await capture(page, 'evening-too-early', problems);

  await setReviewTime(request, baseURL!, '00:00');
  await page.goto('/review');
  await page.getByRole('slider', { name: copy.day.respectLabel }).fill('4');
  await page.getByRole('button', { name: copy.day.submitAction }).click();
  await expect(page.getByText(copy.day.waitingTitle('מיכל'))).toBeVisible();
  await capture(page, 'evening-waiting-for-partner', problems);

  expect(problems, problems.join('\n')).toEqual([]);
});

test('couple: dark mode, every screen', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const problems: string[] = [];
  watch(page, problems);
  resetCounter();

  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page, OWNER);

  for (const path of ['/', '/review', '/week', '/month', '/settings', '/archive']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await capture(page, `dark-${path === '/' ? 'home' : path.replace(/^\//, '')}`, problems);
  }

  expect(problems, problems.join('\n')).toEqual([]);
});
