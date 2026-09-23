import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { copy } from '@/domain/copy';

export const OWNER = 'owner';
export const PARTNER = 'partner';
/** A third active account: holds the PARTNER role but is not in the link. */
export const OUTSIDER = 'partner2';

/** Adds a task to today's list through the UI and returns its title. */
export async function addTask(page: Page, title: string, owner: 'me' | 'partner'): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: copy.tasks.addAction }).first().click();

  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(copy.tasks.titleLabel).fill(title);

  // The owner control is a two-option segmented radio group. Its inputs are
  // sr-only (the tile is the visible control), so the label is what a person
  // actually clicks — and therefore what the test clicks. Picking by position
  // keeps the helper independent of the fixture names.
  const tiles = sheet.getByRole('group', { name: copy.tasks.ownerLabel }).locator('label');
  await tiles.nth(owner === 'me' ? 0 : 1).click();

  await sheet.getByRole('button', { name: copy.common.add }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  return title;
}

/** The card containing a given task title. */
export function taskCard(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title });
}

/**
 * Completes a task from its card, and waits for the server to have it.
 * Completion is optimistic — the card changes under the finger before the
 * request leaves — so a navigation straight after the click would abort the
 * write and leave the test looking at a task that was never completed.
 */
export async function completeTask(page: Page, title: string): Promise<void> {
  const saved = page.waitForResponse((r) => /\/api\/tasks\/[^/]+\/transition$/.test(r.url()) && r.request().method() === 'POST');
  // The list then refreshes itself from the server. Navigating while that is
  // in flight cancels it, which WebKit reports as a console error ("Load
  // failed") — noise, but noise the sweeps rightly refuse, so wait for it.
  const path = new URL(page.url()).pathname;
  const refreshed = page.waitForResponse((r) => r.request().headers()['rsc'] === '1' && !r.request().headers()['next-router-prefetch'] && new URL(r.url()).pathname === path);
  await taskCard(page, title).getByRole('button', { name: copy.tasks.completeAction }).click();
  expect((await saved).ok()).toBe(true);
  await refreshed;
}

/**
 * Signs out through the UI, the way a person does — which is a different
 * gesture on each layout: the sidebar holds it on a desktop, and on a phone it
 * is inside the "more" sheet.
 */
export async function signOut(page: Page): Promise<void> {
  const more = page.getByRole('button', { name: 'עוד' });
  // Closing the day is immersive: the bar steps aside there, so leave it first.
  if (!(await more.isVisible()) && !(await page.getByRole('button', { name: 'יציאה' }).first().isVisible())) {
    await page.goto('/');
  }
  if (await more.isVisible()) {
    await more.click();
    const sheet = page.getByTestId('mobile-more-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'יציאה' }).click();
  } else {
    await page.getByRole('button', { name: 'יציאה' }).first().click();
  }
  await page.waitForURL(/\/login/);
}

/**
 * Moves the shared review time. The day cannot be closed before it, so a spec
 * that needs the closing flow open moves it to 00:00 and a spec that needs the
 * "too early" state moves it out of reach. Only an account with
 * `settings.manage` may do this — the same rule the settings screen enforces.
 */
export async function setReviewTime(request: APIRequestContext, baseURL: string, time: string): Promise<void> {
  const response = await request.put('/api/review-time', { data: { time }, headers: { Origin: baseURL } });
  expect(response.status(), await response.text()).toBe(200);
}

/** The signed-in user's own id, which the API tells anyone who asks about themselves. */
export async function whoami(request: APIRequestContext): Promise<string> {
  const response = await request.get('/api/auth/me');
  expect(response.status()).toBe(200);
  return ((await response.json()) as { id: string }).id;
}

/**
 * Drags a 1–5 slider the way a finger does: press at its "1" end, move to the
 * stop for `value`, let go. The slider is mirrored for Hebrew (1 at the right,
 * 5 at the left), and its light is `thumb` px wide, so the stops sit between
 * thumb/2 from each edge.
 */
export async function dragSlider(page: Page, slider: Locator, value: 1 | 2 | 3 | 4 | 5, thumb = 56): Promise<void> {
  const box = await slider.locator('..').boundingBox();
  if (!box) throw new Error('the slider has no box');
  const y = box.y + box.height / 2;
  const at = (v: number) => box.x + thumb / 2 + (box.width - thumb) * (1 - (v - 1) / 4);
  await page.mouse.move(at(1), y);
  await page.mouse.down();
  await page.mouse.move(at(value), y, { steps: 10 });
  await page.mouse.up();
}
