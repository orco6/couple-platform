/**
 * THE PRODUCT'S OWN SHELL: every destination in the navigation exists, and the
 * two screens that only exist for the couple — settings and the archive — do
 * what they say.
 *
 * The first test is here because it is the one that catches a whole class of
 * mistake no other spec sees: a nav item pointing at a route that was never
 * built. `/settings` and `/archive` were both in the bar for a while with no
 * page behind them, and every other spec passed the entire time.
 *
 * (`shell.spec.ts` matches the mobile project too, which is where the "more"
 * sheet holds half of these links.)
 */

import { expect, test } from '@playwright/test';

import { copy } from '@/domain/copy';

import { login, uniqueName, watchForProblems } from '../helpers';
import { addTask, signOut, taskCard, OWNER, PARTNER } from './helpers';

const hrefsOf = (links: Element[]) =>
  links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? '');

test('every destination in the navigation renders a real page', async ({ page, isMobile }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);

  // On a phone four destinations are on the bar and the rest live in the
  // "more" sheet, so both have to be collected — before navigating anywhere,
  // because the first navigation closes the sheet.
  const hrefs = await page.getByRole('navigation', { name: 'ניווט ראשי' }).last().getByRole('link').evaluateAll(hrefsOf);
  if (isMobile) {
    await page.getByRole('button', { name: 'עוד' }).click();
    const sheet = page.getByTestId('mobile-more-sheet');
    await expect(sheet).toBeVisible();
    hrefs.push(...(await sheet.getByRole('link').evaluateAll(hrefsOf)));
  }
  expect(hrefs.length).toBeGreaterThan(4);

  for (const href of hrefs) {
    const response = await page.goto(href);
    expect(response?.status(), href).toBe(200);
    // Next's not-found page has its own heading, so the status alone is not
    // enough — a real page is one that named itself in the title too.
    await expect(page.getByRole('heading', { level: 1 }).first(), href).toBeVisible();
    await expect(page, href).not.toHaveTitle(/404|not found/i);
  }

  problems.assertClean();
});

test('the shared review time can be moved by the owner and is read-only for the partner', async ({ page }) => {
  await login(page, OWNER);
  await page.goto('/settings');

  const field = page.getByLabel(copy.settings.reviewTimeLabel);
  await field.fill('20:15');
  await page.getByRole('button', { name: copy.common.save }).click();
  await expect(page.getByRole('status').filter({ hasText: copy.settings.reviewTimeSaved })).toBeVisible();

  // It is the same hour the rest of the product speaks in. A future date is
  // the one screen that always says it, whatever this run has already done to
  // today.
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  await page.goto(`/review?date=${tomorrow}`);
  await expect(page.getByText(copy.day.notOpenYetWhy('20:15'))).toBeVisible();

  // The other partner sees the hour and who changes it, not a control.
  await signOut(page);
  await login(page, PARTNER);
  await page.goto('/settings');
  await expect(page.getByText('20:15')).toBeVisible();
  await expect(page.getByText(copy.settings.reviewTimeReadOnly)).toBeVisible();
  await expect(page.getByLabel(copy.settings.reviewTimeLabel)).toHaveCount(0);
});

test('a task is deleted for good with a swipe, for both partners', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לבטל מנוי'), 'me');
  const row = taskCard(page, title);

  // A task just sent enters with a short animation; swipe it once it has landed.
  await row.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));

  // On a phone the new row can sit under the tab bar: bring it to the middle.
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }));

  // Swipe the row toward the right: the delete action uncovers at the left.
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, y, { steps: 12 });
  await page.mouse.up();
  const del = row.getByRole('button', { name: copy.tasks.deleteShort });
  await expect(del).toBeVisible();

  const deleted = page.waitForResponse((r) => r.url().includes('/api/tasks/') && r.request().method() === 'DELETE');
  await del.click();
  expect((await deleted).status()).toBe(200);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  // Gone for good: after a reload, and for the other partner.
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await signOut(page);
  await login(page, PARTNER);
  await page.goto('/');
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test('a task can also be deleted from its edit screen, after a confirmation', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('להחזיר ספר'), 'partner');

  await taskCard(page, title).getByRole('button', { name: new RegExp(title) }).click();
  await page.getByTestId('composer').getByRole('button', { name: copy.tasks.deleteAction }).click();

  // Cancel first: nothing happens.
  const confirm = page.getByRole('dialog', { name: copy.tasks.deleteTitle });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: copy.common.cancel }).click();
  await expect(taskCard(page, title)).toHaveCount(1);

  // Then for real.
  await taskCard(page, title).getByRole('button', { name: new RegExp(title) }).click();
  await page.getByTestId('composer').getByRole('button', { name: copy.tasks.deleteAction }).click();
  const deleted = page.waitForResponse((r) => r.url().includes('/api/tasks/') && r.request().method() === 'DELETE');
  await page.getByRole('dialog', { name: copy.tasks.deleteTitle }).getByRole('button', { name: copy.tasks.deleteShort }).click();
  expect((await deleted).status()).toBe(200);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});
