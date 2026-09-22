/**
 * SAMPLE DOMAIN: IDOR and field-forging at the HTTP boundary for the sample's
 * entities. Delete with the sample and REWRITE for your domain's entities —
 * every entity needs the equivalent of these checks.
 */

import { expect, request as playwrightRequest, test } from '@playwright/test';
import { apiLogin, login } from '../helpers';

const MANAGER = 'manager';
const STAFF = 'staff';

test.describe('sample entity security', () => {
  test('unauthenticated entity endpoints get 401', async ({ request }) => {
    for (const path of ['/api/customers', '/api/tasks']) expect((await request.get(path)).status(), path).toBe(401);
  });

  test('staff cannot read or change another person’s records by altering ids', async ({ baseURL }) => {
    const staff = await playwrightRequest.newContext({ baseURL });
    await apiLogin(staff, baseURL!, STAFF);
    const me = await (await staff.get('/api/auth/me')).json();

    const manager = await playwrightRequest.newContext({ baseURL });
    await apiLogin(manager, baseURL!, MANAGER);
    const all = (await (await manager.get('/api/customers')).json()).customers as Array<{ id: string; owner: { id: string } }>;
    const foreign = all.find((customer) => customer.owner.id !== me.id)!;
    const own = all.find((customer) => customer.owner.id === me.id)!;
    const tasks = (await (await manager.get('/api/tasks')).json()).tasks as Array<{ id: string; assignee: { id: string } | null; customer: { id: string } }>;
    const foreignTask = tasks.find((task) => task.assignee?.id !== me.id && task.customer.id === foreign.id)!;
    await manager.dispose();

    const origin = { Origin: baseURL! };
    expect((await staff.get(`/api/customers/${foreign.id}`)).status()).toBe(404);
    expect((await staff.patch(`/api/customers/${foreign.id}`, { data: { name: 'נחטף' }, headers: origin })).status()).toBe(404);
    expect((await staff.post(`/api/customers/${foreign.id}/notes`, { data: { body: 'x' }, headers: origin })).status()).toBe(404);
    expect((await staff.post(`/api/customers/${foreign.id}/archive`, { data: {}, headers: origin })).status()).toBe(403);
    expect((await staff.get(`/api/tasks/${foreignTask.id}`)).status()).toBe(404);
    expect((await staff.post(`/api/tasks/${foreignTask.id}/transition`, { data: { version: 1, to: 'CANCELLED' }, headers: origin })).status()).toBe(404);
    expect((await staff.post('/api/follow-ups', { data: { entityType: 'customer', entityId: foreign.id, kind: 'call_back' }, headers: origin })).status()).toBe(404);

    const listed = (await (await staff.get('/api/customers')).json()).customers as Array<{ owner: { id: string } }>;
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((customer) => customer.owner.id === me.id)).toBe(true);

    const reassign = await staff.patch(`/api/customers/${own.id}`, { data: { ownerId: foreign.owner.id }, headers: origin });
    expect(reassign.status()).toBe(403);
    const massAssign = await staff.patch(`/api/customers/${own.id}`, { data: { name: 'שם', createdById: 'x', archivedAt: null }, headers: origin });
    expect(massAssign.status()).toBe(400);
    expect((await massAssign.json()).fieldErrors).toHaveProperty('createdById');
    expect((await staff.post('/api/reports/revenue/2026-01/close', { headers: origin })).status()).toBe(403);
    await staff.dispose();
  });

  test('staff do not see sample admin screens; their URLs answer 404', async ({ page }) => {
    await login(page, STAFF);
    const nav = page.getByRole('navigation', { name: 'ניווט ראשי' }).first();
    await expect(nav.getByRole('link', { name: 'לקוחות' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'הכנסות' })).toHaveCount(0);
    for (const path of ['/reports/revenue', '/print/revenue/2026-01', '/admin/archive']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'הדף לא נמצא' }), path).toBeVisible();
    }
  });
});
