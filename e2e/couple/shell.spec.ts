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

test('an archived task keeps its reason and can be restored to the list', async ({ page }) => {
  await login(page, OWNER);
  const title = await addTask(page, uniqueName('לבטל מנוי'), 'me');

  // Archiving lives inside the edit sheet, where the decision is being made.
  await taskCard(page, title).getByRole('button', { name: new RegExp(title) }).click();
  await page.getByRole('button', { name: copy.tasks.archiveAction }).click();
  await page.getByLabel(copy.tasks.archiveReasonLabel).fill('החלטנו לא לחדש');
  await page.getByRole('button', { name: copy.tasks.archiveAction }).click();

  await expect(page.getByText(title)).toHaveCount(0);

  // It is in the archive, with the reason, and it is not counted as a task.
  await page.goto('/archive');
  const archived = page.getByRole('listitem').filter({ hasText: title });
  await expect(archived).toHaveCount(1);
  await expect(archived.getByText('החלטנו לא לחדש')).toBeVisible();

  // Restoring asks why, and brings it back open.
  await archived.getByRole('button', { name: copy.tasks.restoreAction }).click();
  await page.getByLabel(copy.archivePage.restoreReasonLabel).fill('בכל זאת צריך');
  await page.getByRole('button', { name: copy.tasks.restoreAction }).last().click();
  // Wait for the write to land: navigating while it is in flight cancels it.
  await expect(archived).toHaveCount(0);

  await page.goto('/');
  await expect(taskCard(page, title).getByRole('button', { name: copy.tasks.completeAction })).toBeVisible();
});
