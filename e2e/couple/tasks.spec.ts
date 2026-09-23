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
  // told they are waiting; they are never offered a rating.
  await expect(taskCard(page, title).getByText(copy.taskRating.awaitingShort, { exact: false })).toBeVisible();
  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.prompt })).toHaveCount(0);

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
  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.prompt })).toBeVisible();

  await taskCard(page, title).getByRole('button', { name: copy.tasks.reopenAction }).click();
  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.prompt })).toHaveCount(0);
});

test('an existing task can be edited and saved — and no raw validation text ever shows', async ({ page }) => {
  // Regression: the edit form once sent its PATCH without the task's id, and
  // the person saw Zod's own "Invalid input: expected string, received
  // undefined" at the top of the form (docs/adr/0015).
  const problems = watchForProblems(page);
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לקבוע תור'), 'me');

  await taskCard(page, title).getByRole('button', { name: new RegExp(title) }).click();
  const composer = page.getByTestId('composer');
  const field = composer.getByLabel(copy.tasks.titleLabel);
  await expect(field).toHaveValue(title);

  const renamed = `${title} לרופא`;
  await field.fill(renamed);
  // Tomorrow, and back to today: the date chips, not a text field.
  await composer.getByRole('button', { name: copy.tasks.tomorrow }).click();
  await composer.getByRole('button', { name: copy.common.today }).click();
  const saved = page.waitForResponse((r) => r.url().includes('/api/tasks/') && r.request().method() === 'PATCH');
  await composer.getByRole('button', { name: copy.common.save }).click();
  expect((await saved).status()).toBe(200);
  await expect(composer).toBeHidden();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();

  // Whatever happened, nothing in Latin letters reached the screen.
  await expect(page.getByText(/Invalid input|expected string|received undefined/)).toHaveCount(0);
  problems.assertClean();
});

test('a task is given another day through the calendar, without typing', async ({ page }) => {
  await login(page, OWNER);
  await page.goto('/');
  await page.getByRole('button', { name: copy.tasks.addAction }).click();
  const composer = page.getByTestId('composer');
  const name = uniqueName('לשלוח מתנה');
  await composer.getByLabel(copy.tasks.titleLabel).fill(name);

  await composer.getByRole('button', { name: copy.tasks.chooseDate }).click();
  const calendar = page.getByTestId('calendar');
  await expect(calendar).toBeVisible();
  // Today is marked, and the next month is one tap away.
  await expect(calendar.locator('[aria-current="date"]')).toHaveCount(1);
  await calendar.getByRole('button', { name: copy.tasks.nextMonth }).click();
  await calendar.getByRole('button', { name: /^.+ 3 ב/ }).first().click();
  await expect(calendar).toBeHidden();
  // The chip now says the day that was chosen.
  await expect(composer.getByRole('button', { name: new RegExp(`^${copy.tasks.chooseDate}: `) })).toBeVisible();

  const created = page.waitForResponse((r) => r.url().endsWith('/api/tasks') && r.request().method() === 'POST');
  await composer.getByRole('button', { name: copy.common.add }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const body = response.request().postDataJSON() as { taskDate: string };
  expect(body.taskDate.slice(8)).toBe('03');
  // Not today, so not on today's list.
  await expect(composer).toBeHidden();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});
