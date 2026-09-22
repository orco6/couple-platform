/** CORE: the application shell on phones and desktops, independent of the domain's pages. */

import { expect, test } from '@playwright/test';
import { CORE_USERS, expectNoHorizontalOverflow, login, watchForProblems } from '../helpers';

const CORE_PAGES = ['/', '/attention', '/account', '/admin/users', '/admin/audit', '/admin/settings'];

test('every core page renders without sideways scrolling or console errors', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, CORE_USERS.top);
  for (const path of CORE_PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first(), path).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  problems.assertClean();
});

test('mobile: bottom navigation and the "more" sheet reach account and sign-out', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout only');
  await login(page, CORE_USERS.top);
  const bar = page.getByRole('navigation', { name: 'ניווט ראשי' }).last();
  await expect(bar).toBeVisible();

  await bar.getByRole('button', { name: 'עוד' }).click();
  const sheet = page.getByTestId('mobile-more-sheet');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', { name: 'החשבון שלי' }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/account$/);
  await expectNoHorizontalOverflow(page);

  await bar.getByRole('button', { name: 'עוד' }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'יציאה' }).click();
  await page.waitForURL('**/login');
});

test('desktop: sidebar marks the current page for assistive technology', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout only');
  await login(page, CORE_USERS.top);
  await page.goto('/admin/users');
  const current = page.getByRole('navigation', { name: 'ניווט ראשי' }).first().locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText('משתמשים');
});

test('mobile: the bottom tab bar steps aside while typing and returns afterwards', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout only');
  await login(page, CORE_USERS.top);
  await page.goto('/account');
  const bar = page.locator('[data-mobile-tab-bar]');
  await expect(bar).toBeVisible();
  const field = page.getByLabel('הסיסמה הנוכחית');
  await field.focus();
  await expect(bar).toBeHidden();
  await field.blur();
  await expect(bar).toBeVisible();
});
