/** CORE: authentication flows. Must pass for any business domain. */

import { expect, test } from '@playwright/test';
import { CORE_USERS, login, PASSWORD, watchForProblems } from '../helpers';

test.describe('authentication', () => {
  test('sign in and sign out; the old session is really gone', async ({ page }) => {
    const problems = watchForProblems(page);
    await login(page, CORE_USERS.unprivileged);
    await expect(page.getByRole('main')).toBeVisible();
    await page.getByRole('button', { name: 'יציאה' }).first().click();
    await page.waitForURL('**/login');

    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
    problems.assertClean();
  });

  test('wrong password, unknown user and disabled account get the same message', async ({ page }) => {
    await page.goto('/login');
    // Filtered: Next.js also renders an (empty) role="alert" route announcer.
    const message = page.getByRole('alert').filter({ hasText: /\S/ });

    for (const [username, password] of [
      [CORE_USERS.unprivileged2, 'not-the-password'],
      ['nobody-by-this-name', PASSWORD],
      [CORE_USERS.disabled, PASSWORD],
    ] as const) {
      await page.getByLabel('שם משתמש').fill(username);
      await page.getByLabel('סיסמה', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'כניסה' }).click();
      await expect(message).toHaveText('שם המשתמש או הסיסמה אינם נכונים.');
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('returns to the requested page after sign-in, and ignores off-site redirects', async ({ page }) => {
    await page.goto('/account?tab=security');
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel('שם משתמש').fill(CORE_USERS.top);
    await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await page.waitForURL('**/account?tab=security');

    for (const next of ['//evil.example/steal', 'https://evil.example', '/\\evil.example']) {
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.getByLabel('שם משתמש').fill(CORE_USERS.top);
      await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: 'כניסה' }).click();
      await page.waitForURL((url) => !url.pathname.startsWith('/login'));
      expect(new URL(page.url()).host, next).toMatch(/^localhost/);
    }
  });

  test('a temporary password must be replaced before anything else works — pages AND API', async ({ page }) => {
    await login(page, CORE_USERS.pending);
    await expect(page).toHaveURL(/\/change-password/);

    await page.goto('/account');
    await expect(page).toHaveURL(/\/change-password/);
    const api = await page.request.get('/api/admin/users');
    expect(api.status()).toBe(403);
    expect((await api.json()).error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    await page.getByLabel('הסיסמה הזמנית').fill(PASSWORD);
    await page.getByLabel('סיסמה חדשה', { exact: true }).fill('short');
    await page.getByLabel('אימות הסיסמה החדשה').fill('short');
    await page.getByRole('button', { name: 'שמירה והמשך' }).click();
    await expect(page.getByText('הסיסמה צריכה להכיל לפחות 10 תווים.').first()).toBeVisible();

    await page.getByLabel('סיסמה חדשה', { exact: true }).fill('a much better phrase');
    await page.getByLabel('אימות הסיסמה החדשה').fill('a much better phrase');
    await page.getByRole('button', { name: 'שמירה והמשך' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  });

  test('pasted passwords with invisible characters still work', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('שם משתמש').fill(CORE_USERS.unprivileged2);
    const rlm = String.fromCharCode(0x200f);
    await page.getByLabel('סיסמה', { exact: true }).fill(`${rlm}${PASSWORD} ${rlm}`);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  });

  test('an administrator creates a user whose temporary password works exactly once', async ({ page, browser }) => {
    await login(page, CORE_USERS.top);
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'משתמש חדש' }).click();
    const dialog = page.getByRole('dialog', { name: 'משתמש חדש' });
    const username = `qa-${Date.now().toString(36).slice(-6)}`;
    await dialog.getByLabel('שם', { exact: true }).fill('עובדת חדשה');
    await dialog.getByLabel('שם משתמש').fill(username);
    await dialog.getByRole('button', { name: 'יצירת המשתמש' }).click();
    const temporary = await page.getByTestId('temporary-password').textContent();
    expect(temporary).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    await page.getByRole('button', { name: 'העברתי את הסיסמה' }).click();
    await expect(page.getByTestId('temporary-password')).toHaveCount(0);

    const other = await browser.newPage();
    await login(other, username, temporary!);
    await expect(other).toHaveURL(/\/change-password/);
    await other.close();
  });
});
