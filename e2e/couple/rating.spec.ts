/**
 * R-RATE-01 — only the partner who does NOT own a task may rate it — and the
 * gesture that gives the rating (fourth edition): one drag along a slider,
 * committed only when the finger lets go, and never while it is down.
 */

import { expect, test, type Page } from '@playwright/test';

import { copy } from '@/domain/copy';

import { login, uniqueName, watchForProblems } from '../helpers';
import { addTask, completeTask, dragSlider, signOut, taskCard, OWNER, PARTNER } from './helpers';

/** A task of the partner's, completed by the owner: the owner may rate it. */
async function rateable(page: Page, name: string) {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName(name), 'partner');
  await completeTask(page, title);
  await taskCard(page, title).getByRole('button', { name: copy.taskRating.prompt }).click();
  const sheet = page.getByTestId('rate-sheet');
  const slider = sheet.getByRole('slider');
  await expect(slider).toBeVisible();
  return { title, sheet, slider };
}

/** Every rating POST the page sends, by value. */
function ratings(page: Page) {
  const sent: number[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/task-ratings') && request.method() === 'POST') {
      sent.push((request.postDataJSON() as { value: number }).value);
    }
  });
  return sent;
}

test('the partner rates a completed task with one drag, and the owner sees the result', async ({ page }) => {
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

  // One slider in a focused sheet, saying what it is before it is touched.
  const sheet = page.getByTestId('rate-sheet');
  const slider = sheet.getByRole('slider', { name: copy.taskRating.prompt });
  await expect(slider).toHaveAttribute('aria-valuetext', copy.taskRating.hint);

  // Drag to the fourth stop and let go: the word says it, then the sheet leaves.
  await dragSlider(page, slider, 4);
  await expect(slider).toHaveAttribute('aria-valuetext', `4 — ${copy.taskRating.scale[4]}`);
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
  await expect(taskCard(page, title).getByRole('slider')).toHaveCount(0);
});

test('nothing is saved while the finger is down — only when it lets go', async ({ page }) => {
  const { sheet, slider } = await rateable(page, 'לתלות כביסה');
  const sent = ratings(page);

  const box = (await slider.locator('..').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 28, y);
  await page.mouse.down();
  // A slow drag across the whole scale and back, holding on.
  for (const fraction of [0.2, 0.5, 0.9, 0.6]) {
    await page.mouse.move(box.x + box.width - 28 - (box.width - 56) * fraction, y, { steps: 6 });
    await page.waitForTimeout(250);
  }
  // Held for well over the confirm delay: still open, nothing sent.
  await page.waitForTimeout(1200);
  await expect(sheet).toBeVisible();
  expect(sent).toEqual([]);

  const saved = page.waitForResponse((r) => r.url().endsWith('/api/task-ratings') && r.request().method() === 'POST');
  await page.mouse.up();
  expect((await saved).ok()).toBe(true);
  await expect(sheet).toBeHidden();
  expect(sent).toHaveLength(1);
});

test('a touch the browser takes back (pointercancel) gives no answer', async ({ page }) => {
  const { sheet, slider } = await rateable(page, 'להוריד את הזבל');
  const sent = ratings(page);

  const box = (await slider.locator('..').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 28, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, y, { steps: 6 });
  await expect(slider).toHaveAttribute('aria-valuetext', /^3 —/);

  // The system takes the touch (a scroll, a notification swipe).
  await slider.locator('..').dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true });
  await page.mouse.up();

  await expect(slider).toHaveAttribute('aria-valuetext', copy.taskRating.hint);
  await page.waitForTimeout(1500);
  await expect(sheet).toBeVisible();
  expect(sent).toEqual([]);
});

test('letting go outside the track commits what the light shows', async ({ page }) => {
  const { sheet, slider } = await rateable(page, 'לקנות מתנה');
  const box = (await slider.locator('..').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 28, y);
  await page.mouse.down();
  // Past the "5" end and well above the sheet.
  await page.mouse.move(box.x - 60, y - 160, { steps: 10 });
  await expect(slider).toHaveAttribute('aria-valuetext', `5 — ${copy.taskRating.scale[5]}`);
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/task-ratings') && r.request().method() === 'POST');
  await page.mouse.up();
  expect((await saved).request().postDataJSON()).toMatchObject({ value: 5 });
  await expect(sheet).toBeHidden();
});

test('a second touch before the sheet leaves replaces the answer — one save, the last one', async ({ page }) => {
  const { title, sheet, slider } = await rateable(page, 'להשקות עציצים');
  const sent = ratings(page);

  await dragSlider(page, slider, 2);
  // Changed their mind at once, inside the confirm moment.
  await dragSlider(page, slider, 5);
  await expect(sheet).toBeHidden();
  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[5]) })).toBeVisible();
  await page.waitForTimeout(400);
  expect(sent).toEqual([5]);
});

test('a tap works as well as a drag', async ({ page }) => {
  const { sheet, slider } = await rateable(page, 'לתקן מדף');
  const box = (await slider.locator('..').boundingBox())!;
  // The middle of the track is 3.
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/task-ratings') && r.request().method() === 'POST');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect((await saved).request().postDataJSON()).toMatchObject({ value: 3 });
  await expect(sheet).toBeHidden();
});

test('the rater may change their mind; the rating is replaced, not added to', async ({ page }) => {
  const { title, slider } = await rateable(page, 'לנקות חלונות');

  // The rating is optimistic and queued behind the completion: wait for it to
  // reach the server before reloading, or the reload aborts it.
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/task-ratings') && r.request().method() === 'POST');
  await dragSlider(page, slider, 2);
  expect((await saved).ok()).toBe(true);

  // After a reload the row carries the word; changing it is the same gesture,
  // and the sheet opens on the answer already given.
  await page.reload();
  const rated = taskCard(page, title).getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[2]) });
  await expect(rated).toBeVisible();
  await rated.click();
  const sheet = page.getByTestId('rate-sheet');
  const again = sheet.getByRole('slider');
  await expect(again).toHaveAttribute('aria-valuetext', `2 — ${copy.taskRating.scale[2]}`);

  // By keyboard this time: End is 5, Enter gives it.
  await again.focus();
  await page.keyboard.press('End');
  await expect(again).toHaveAttribute('aria-valuetext', `5 — ${copy.taskRating.scale[5]}`);
  await page.keyboard.press('Enter');
  await expect(sheet).toBeHidden();
  await expect(taskCard(page, title).getByRole('button', { name: copy.taskRating.myRatedLine(copy.taskRating.scale[5]) })).toBeVisible();
});
