/**
 * CORE: forms behave safely before and outside React.
 * Both failures were reproduced on this foundation before the fixes.
 */

import { expect, test } from '@playwright/test';
import { CORE_USERS, PASSWORD } from '../helpers';

test.describe('before hydration (JavaScript disabled)', () => {
  test.use({ javaScriptEnabled: false });

  test('pressing Enter never puts the username or password in the URL', async ({ page }) => {
    const navigations: string[] = [];
    page.on('request', (request) => {
      if (request.isNavigationRequest()) navigations.push(`${request.method()} ${request.url()}`);
    });
    await page.goto('/login');
    await page.getByLabel('שם משתמש').fill(CORE_USERS.top);
    await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
    await page.getByLabel('סיסמה', { exact: true }).press('Enter');
    await page.waitForLoadState('load');
    expect(page.url()).not.toContain(PASSWORD);
    for (const navigation of navigations) expect(navigation).not.toContain(PASSWORD);
    expect(navigations.some((n) => n.startsWith('GET') && n.includes('username='))).toBe(false);
  });
});

test('sign-in accepts values a password manager filled without input events', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'כניסה' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    ([username, password]) => {
      document.querySelector<HTMLInputElement>('input[name="username"]')!.value = username!;
      document.querySelector<HTMLInputElement>('input[name="password"]')!.value = password!;
    },
    [CORE_USERS.top, PASSWORD],
  );
  await page.getByRole('button', { name: 'כניסה' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
});

test('a save refused because the session ended keeps what was typed and offers sign-in in a new tab', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByLabel('שם משתמש').fill(CORE_USERS.unprivileged2);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

  await page.goto('/account');
  const current = page.getByLabel('הסיסמה הנוכחית');
  await current.fill('something typed before the break');

  // The session ends while the person is working (expiry, sign-out elsewhere).
  await context.clearCookies();
  await page.getByRole('button', { name: 'עדכון הסיסמה' }).click();

  const notice = page.getByTestId('session-notice');
  await expect(notice).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
  await expect(current).toHaveValue('something typed before the break');
  const signIn = notice.getByRole('link', { name: 'התחברות מחדש בלשונית חדשה' });
  await expect(signIn).toHaveAttribute('target', '_blank');

  // Sign in again in another tab (same browser, shared cookie), then return.
  const other = await context.newPage();
  await other.goto('/login');
  await other.getByLabel('שם משתמש').fill(CORE_USERS.unprivileged2);
  await other.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await other.getByRole('button', { name: 'כניסה' }).click();
  await other.waitForURL((url) => !url.pathname.startsWith('/login'));
  await other.close();

  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(notice).toContainText('ההתחברות חודשה');
  await expect(current).toHaveValue('something typed before the break');
});
