import { expect, type Page } from '@playwright/test';

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

/** Completes a task from its card. */
export async function completeTask(page: Page, title: string): Promise<void> {
  await taskCard(page, title).getByRole('button', { name: copy.tasks.completeAction }).click();
}

/** Signs out through the UI, the way a person does. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'יציאה' }).first().click();
  await page.waitForURL(/\/login/);
}
