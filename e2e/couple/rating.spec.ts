/**
 * R-RATE-01 — only the partner who does NOT own a task may rate it, and the
 * rating is one tap.
 */

import { expect, test } from '@playwright/test';

import { copy } from '@/domain/copy';

import { login, uniqueName, watchForProblems } from '../helpers';
import { addTask, completeTask, signOut, taskCard, OWNER, PARTNER } from './helpers';

test('the partner rates a completed task in one tap, and the owner sees the result', async ({ page }) => {
  const problems = watchForProblems(page);

  // The owner creates and finishes a task that is theirs.
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לתקן את הברז'), 'me');
  await completeTask(page, title);
  await expect(taskCard(page, title).getByText(copy.taskRating.awaitingShort, { exact: false })).toBeVisible();

  // The other partner signs in and is invited to rate — in the row, one word.
  await signOut(page);
  await login(page, PARTNER);
  await page.goto('/');

  const card = taskCard(page, title);
  await card.getByRole('button', { name: copy.taskRating.prompt }).click();

  // The five lights live in a focused sheet, not in the list.
  const sheet = page.getByTestId('rate-sheet');
  const lights = sheet.getByRole('radio');
  await expect(lights).toHaveCount(5);

  // One tap on the fourth. No confirm step: the sheet leaves by itself.
  await lights.nth(3).click();
  await expect(sheet.getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^4 —/);
  await expect(sheet).toBeHidden();
  await expect(card.getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[4]) })).toBeVisible();

  // Back as the owner: the rating is there and the waiting state is gone.
  await signOut(page);
  await login(page, OWNER);
  await page.goto('/');
  await expect(taskCard(page, title).getByText(copy.taskRating.scale[4], { exact: false }).first()).toBeVisible();
  await expect(taskCard(page, title).getByText(copy.taskRating.awaitingShort, { exact: false })).toHaveCount(0);

  problems.assertClean();
});

test('the owner is never offered a rating on their own completed task', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לסדר את המזווה'), 'me');
  await completeTask(page, title);

  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.prompt })).toHaveCount(0);
  await expect(taskCard(page, title).getByRole('radio')).toHaveCount(0);
});

test('the rater may change their mind; the rating is replaced, not added to', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('להשקות עציצים'), 'partner');
  await completeTask(page, title);

  const card = taskCard(page, title);
  // The rating is optimistic and queued behind the completion: wait for it to
  // reach the server before reloading, or the reload aborts it.
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/task-ratings') && r.request().method() === 'POST');
  await card.getByRole('button', { name: copy.taskRating.prompt }).click();
  await page.getByTestId('rate-sheet').getByRole('radio').nth(1).click();
  expect((await saved).ok()).toBe(true);

  // After a reload the row carries the word; changing it is the same gesture,
  // and the sheet opens on the answer already given.
  await page.reload();
  const rated = taskCard(page, title).getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[2]) });
  await expect(rated).toBeVisible();
  await rated.click();
  const sheet = page.getByTestId('rate-sheet');
  await expect(sheet.getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^2 —/);
  await sheet.getByRole('radio').nth(4).click();
  await expect(sheet).toBeHidden();
  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[5]) })).toBeVisible();
});
