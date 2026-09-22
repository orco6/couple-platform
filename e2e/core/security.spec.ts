/**
 * CORE: security at the HTTP boundary for platform endpoints — bypassing the UI.
 * Business-entity IDOR checks live in e2e/sample (and must be rewritten per domain).
 */

import { expect, request as playwrightRequest, test } from '@playwright/test';
import { topRoles } from '@/core/access/role-queries';
import { apiLogin, CORE_USERS, login, PASSWORD } from '../helpers';

test.describe('platform API and direct-URL security', () => {
  test('unauthenticated requests get 401 with no-store, never data', async ({ request }) => {
    for (const path of ['/api/admin/users', '/api/admin/audit', '/api/auth/me']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
      expect(response.headers()['cache-control']).toContain('no-store');
    }
  });

  test('users without admin permissions get 403 from every admin endpoint, and 404 on admin pages', async ({ baseURL, page }) => {
    const staff = await playwrightRequest.newContext({ baseURL });
    await apiLogin(staff, baseURL!, CORE_USERS.unprivileged);
    const origin = { Origin: baseURL! };
    const me = await (await staff.get('/api/auth/me')).json();

    expect((await staff.get('/api/admin/users')).status()).toBe(403);
    expect((await staff.get(`/api/admin/users/${me.id}`)).status()).toBe(403);
    expect((await staff.get('/api/admin/audit')).status()).toBe(403);
    expect((await staff.post('/api/admin/users', { data: { name: 'x y', username: 'backdoor', role: me.role }, headers: origin })).status()).toBe(403);
    expect((await staff.patch(`/api/admin/users/${me.id}`, { data: { role: topRoles()[0] }, headers: origin })).status()).toBe(403);
    expect((await staff.post(`/api/admin/users/${me.id}/password-reset`, { headers: origin })).status()).toBe(403);
    expect((await staff.put('/api/admin/settings/anything', { data: { value: 1 }, headers: origin })).status()).toBe(403);
    await staff.dispose();

    await login(page, CORE_USERS.unprivileged);
    const nav = page.getByRole('navigation', { name: 'ניווט ראשי' }).first();
    await expect(nav.getByRole('link', { name: 'משתמשים' })).toHaveCount(0);
    for (const path of ['/admin/users', '/admin/audit', '/admin/settings']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'הדף לא נמצא' }), path).toBeVisible();
    }
  });

  test('forged fields are rejected (mass assignment) even for administrators', async ({ baseURL }) => {
    const admin = await playwrightRequest.newContext({ baseURL });
    await apiLogin(admin, baseURL!, CORE_USERS.top);
    const origin = { Origin: baseURL! };
    const users = (await (await admin.get('/api/admin/users')).json()).users as Array<{ id: string; username: string }>;
    const target = users.find((user) => user.username === CORE_USERS.unprivileged2)!;

    const forged = await admin.patch(`/api/admin/users/${target.id}`, {
      data: { name: 'שם', passwordHash: 'x', status: 'ACTIVE', mustChangePassword: false },
      headers: origin,
    });
    expect(forged.status()).toBe(400);
    expect(Object.keys((await forged.json()).fieldErrors)).toEqual(expect.arrayContaining(['passwordHash', 'status', 'mustChangePassword']));
    await admin.dispose();
  });

  test('cross-origin state-changing requests are rejected even with a valid session', async ({ baseURL }) => {
    const context = await playwrightRequest.newContext({ baseURL });
    await apiLogin(context, baseURL!, CORE_USERS.top);
    for (const origin of ['https://evil.example', 'null']) {
      const response = await context.post('/api/auth/logout', { headers: { Origin: origin } });
      expect(response.status(), origin).toBe(403);
      expect((await response.json()).error.code).toBe('CROSS_ORIGIN_REJECTED');
    }
    // No Origin and no Referer on a state-changing request: refused too.
    const bare = await context.fetch('/api/auth/logout', { method: 'POST', headers: { Origin: '', Referer: '' } });
    expect(bare.status()).toBe(403);
    // Still signed in: the forged logouts did nothing.
    expect((await context.get('/api/auth/me')).status()).toBe(200);
    await context.dispose();
  });

  test('malformed, oversized and wrongly typed bodies get a clean 400 with no internals', async ({ baseURL }) => {
    const context = await playwrightRequest.newContext({ baseURL });
    const origin = baseURL!;
    const cases = [
      { data: '{"username": ', type: 'application/json' },
      { data: JSON.stringify({ username: 'x'.repeat(400_000), password: 'y' }), type: 'application/json' },
      { data: 'username=a&password=b', type: 'application/x-www-form-urlencoded' },
      { data: JSON.stringify([1, 2, 3]), type: 'application/json' },
    ];
    for (const item of cases) {
      const response = await context.post('/api/auth/login', { data: item.data, headers: { Origin: origin, 'Content-Type': item.type } });
      expect(response.status(), item.type).toBe(400);
      expect(await response.text()).not.toMatch(/at \w+ \(|prisma|SELECT|stack|node_modules/i);
    }
    await context.dispose();
  });

  test('security headers, httpOnly SameSite cookie, and no token in any body', async ({ request, baseURL }) => {
    const headers = (await request.get('/login')).headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-powered-by']).toBeUndefined();

    const signIn = await request.post('/api/auth/login', { data: { username: CORE_USERS.top, password: PASSWORD }, headers: { Origin: baseURL! } });
    const cookie = signIn.headers()['set-cookie'] ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const token = /session=([^;]+)/.exec(cookie)?.[1];
    expect(token).toBeTruthy();
    expect(await signIn.text()).not.toContain(token!);
    expect(await (await request.get('/api/auth/me')).text()).not.toContain(token!);
  });

  test('the component gallery is available outside production only', async ({ request }) => {
    // E2E runs with APP_ENV=test, so it exists here; production returns 404 (unit-tested env + page guard).
    expect((await request.get('/design-system')).status()).toBe(200);
  });
});
