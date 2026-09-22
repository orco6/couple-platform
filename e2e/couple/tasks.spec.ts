/**
 * The shared list: adding a task, completing it, and what each partner sees
 * afterwards.
 */

import { expect, test } from '@playwright/test';

import { copy } from '@/domain/copy';

import { login, uniqueName, watchForProblems } from '../helpers';
import { addTask, completeTask, taskCard, OWNER } from './helpers';

test('a task is added, completed, and then waits for the other partner', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);

  const title = await addTask(page, uniqueName('לקנות חלב'), 'me');

  const card = taskCard(page, title);
  await expect(card.getByRole('button', { name: copy.tasks.completeAction })).toBeVisible();

  await completeTask(page, title);

  // Completing my own task hands the turn to the other partner. The owner is
  // told they are waiting; they are never offered the stars.
  await expect(taskCard(page, title).getByText(copy.taskRating.awaitingShort, { exact: false })).toBeVisible();
  await expect(taskCard(page, title).getByRole('radio')).toHaveCount(0);

  problems.assertClean();
});

test('either partner may complete a task the other owns — the list is shared', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לשלוח חבילה'), 'partner');

  // It is the partner's task, but the owner can still tick it off.
  await completeTask(page, title);
  await expect(taskCard(page, title).getByRole('button', { name: copy.tasks.reopenAction })).toBeVisible();
});

test('a completed task can be reopened, which withdraws the rating offer', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('להחזיר ספר'), 'partner');
  await completeTask(page, title);

  // The owner may rate it (it is the partner's task).
  await expect(taskCard(page, title).getByRole('radio').first()).toBeVisible();

  await taskCard(page, title).getByRole('button', { name: copy.tasks.reopenAction }).click();
  await expect(taskCard(page, title).getByRole('radio')).toHaveCount(0);
});
