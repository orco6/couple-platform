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

  // The other partner signs in and sees the stars on that card.
  await signOut(page);
  await login(page, PARTNER);
  await page.goto('/');

  const card = taskCard(page, title);
  const stars = card.getByRole('radio');
  await expect(stars).toHaveCount(5);

  // One tap on the fourth star. No confirm step, no sheet.
  await stars.nth(3).click();
  await expect(card.getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^4 —/);

  // Back as the owner: the rating is there and the waiting state is gone.
  await signOut(page);
  await login(page, OWNER);
  await page.goto('/');
  await expect(taskCard(page, title).getByText('4', { exact: true })).toBeVisible();
  await expect(taskCard(page, title).getByText(copy.taskRating.awaitingShort, { exact: false })).toHaveCount(0);

  problems.assertClean();
});

test('the owner is never offered stars on their own completed task', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לסדר את המזווה'), 'me');
  await completeTask(page, title);

  await expect(taskCard(page, title).getByRole('radio')).toHaveCount(0);
});

test('the rater may change their mind; the rating is replaced, not added to', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('להשקות עציצים'), 'partner');
  await completeTask(page, title);

  const card = taskCard(page, title);
  await card.getByRole('radio').nth(1).click();
  await expect(card.getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^2 —/);

  await page.reload();
  await taskCard(page, title).getByRole('radio').nth(4).click();
  await expect(taskCard(page, title).getByRole('radio', { checked: true })).toHaveAttribute('aria-label', /^5 —/);
});
