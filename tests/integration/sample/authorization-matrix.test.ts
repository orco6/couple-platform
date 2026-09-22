/**
 * Authorization matrix, against a real database, at the service layer — where
 * the boundary actually is. (The HTTP-level versions of these checks — direct
 * URLs, manual API calls, altered ids — are in e2e/api-security.spec.ts.)
 *
 *   unauthenticated        → e2e (no actor exists at this layer)
 *   staff A → staff B      → 404, never 403, never data
 *   manager/admin          → sees and edits all
 *   disabled user          → tests/integration/auth.test.ts (sessions die)
 *   altered ids / fields   → 404 or 403, nothing written
 *   admin-only operations  → 403 for everyone else
 */

import { describe, expect, it } from 'vitest';
import { listAuditEvents } from '@/core/audit/query';
import { db } from '@/core/db/client';
import { closeFollowUp, createFollowUp, listOpenFollowUps } from '@/core/follow-ups/follow-ups';
import { listSettings, updateSetting } from '@/core/settings/settings';
import { listUsers } from '@/core/users/users';
import { archiveCustomer, getCustomer, listArchivedCustomers, listCustomers, restoreCustomer, updateCustomer } from '@/domain/sample/customers';
import { sampleFollowUpTargets } from '@/domain/sample/follow-up-targets';
import { createNote, deleteNote, listNotes } from '@/domain/sample/notes';
import { closeRevenueMonth, getRevenueReport } from '@/domain/sample/revenue';
import { createTask, getTask, listTasks, transitionTask, updateTask } from '@/domain/sample/tasks';
import { caught, makeUser } from '../../support/factories';
import { makeCustomer, makeTask } from './factories';

async function world() {
  const staffA = await makeUser({ role: 'STAFF', name: 'עובד א' });
  const staffB = await makeUser({ role: 'STAFF', name: 'עובד ב' });
  const manager = await makeUser({ role: 'MANAGER' });
  const admin = await makeUser({ role: 'ADMIN' });
  const customerA = await makeCustomer(staffA);
  const customerB = await makeCustomer(staffB, staffB, 'לקוח של ב');
  const taskB = await makeTask(customerB.id, staffB);
  const noteB = await createNote(db, staffB, customerB.id, { body: 'הערה פרטית של ב' });
  return { staffA, staffB, manager, admin, customerA, customerB, taskB, noteB };
}

describe('staff A cannot reach staff B’s data', () => {
  it('lists contain only own records', async () => {
    const w = await world();
    const customers = await listCustomers(db, w.staffA, {});
    expect(customers.customers.map((c) => c.id)).toEqual([w.customerA.id]);
    const tasks = await listTasks(db, w.staffA, { status: 'active' });
    expect(tasks.tasks).toHaveLength(0);
    expect(await listNotes(db, w.staffA, w.customerB.id)).toEqual([]);
  });

  it('by-id reads answer 404 — indistinguishable from nonexistent', async () => {
    const w = await world();
    const foreign = await caught(() => getCustomer(db, w.staffA, w.customerB.id));
    const missing = await caught(() => getCustomer(db, w.staffA, 'c000000000000000000000000'));
    expect(foreign).toMatchObject({ status: 404 });
    expect(missing).toMatchObject({ status: 404 });
    expect((foreign as unknown as Error).message).toBe((missing as unknown as Error).message);
    expect(await caught(() => getTask(db, w.staffA, w.taskB.id))).toMatchObject({ status: 404 });
  });

  it('writes with altered ids are refused and change nothing', async () => {
    const w = await world();
    expect(await caught(() => updateCustomer(db, w.staffA, w.customerB.id, { name: 'נחטף' }))).toMatchObject({ status: 404 });
    expect(await caught(() => updateTask(db, w.staffA, w.taskB.id, { version: w.taskB.version, title: 'נחטף' }))).toMatchObject({ status: 404 });
    expect(await caught(() => transitionTask(db, w.staffA, w.taskB.id, { version: w.taskB.version, to: 'CANCELLED' }))).toMatchObject({ status: 404 });
    expect(await caught(() => createNote(db, w.staffA, w.customerB.id, { body: 'x' }))).toMatchObject({ status: 404 });
    expect(await caught(() => deleteNote(db, w.staffA, w.noteB.id))).toMatchObject({ status: 404 });
    expect(await caught(() => createTask(db, w.staffA, { customerId: w.customerB.id, title: 'משימה זרה' }))).toMatchObject({ category: 'validation' });

    const unchanged = await db.customer.findUniqueOrThrow({ where: { id: w.customerB.id } });
    expect(unchanged.name).toBe('לקוח של ב');
    expect(await db.note.count({ where: { deletedAt: { not: null } } })).toBe(0);
  });

  it('cannot raise or close follow-ups on records it cannot see', async () => {
    const w = await world();
    expect(
      await caught(() => createFollowUp(db, w.staffA, { entityType: 'customer', entityId: w.customerB.id, kind: 'call_back' }, sampleFollowUpTargets)),
    ).toMatchObject({ status: 404 });
    const followUp = await createFollowUp(db, w.staffB, { entityType: 'customer', entityId: w.customerB.id, kind: 'call_back' }, sampleFollowUpTargets);
    expect(await caught(() => closeFollowUp(db, w.staffA, followUp.id, 'RESOLVED', null))).toMatchObject({ status: 404 });
    expect(await listOpenFollowUps(db, w.staffA)).toEqual([]);
  });
});

describe('field-level permissions (hidden form fields cannot be forged)', () => {
  it('staff cannot reassign ownership, set prices, or assign tasks to others', async () => {
    const w = await world();
    expect(await caught(() => updateCustomer(db, w.staffA, w.customerA.id, { ownerId: w.staffB.id }))).toMatchObject({ status: 403 });
    expect(await caught(() => createTask(db, w.staffA, { customerId: w.customerA.id, title: 'עם מחיר', priceAgorot: 100 }))).toMatchObject({ status: 403 });
    expect(await caught(() => createTask(db, w.staffA, { customerId: w.customerA.id, title: 'לאחר', assigneeId: w.staffB.id }))).toMatchObject({ status: 403 });
    const own = await makeTask(w.customerA.id, w.staffA);
    expect(await caught(() => updateTask(db, w.staffA, own.id, { version: own.version, priceAgorot: 5000 }))).toMatchObject({ status: 403 });
  });

  it('staff cannot reopen finished work', async () => {
    const w = await world();
    const own = await makeTask(w.customerA.id, w.staffA);
    const done = await transitionTask(db, w.staffA, own.id, { version: own.version, to: 'DONE' });
    expect(await caught(() => transitionTask(db, w.staffA, own.id, { version: done.version, to: 'IN_PROGRESS', reason: 'רוצה לשנות' }))).toMatchObject({ status: 403 });
  });

  it('staff can delete their own note but not someone else’s on a shared customer', async () => {
    const w = await world();
    const mine = await createNote(db, w.staffA, w.customerA.id, { body: 'שלי' });
    const managers = await createNote(db, w.manager, w.customerA.id, { body: 'של המנהל' });
    expect(await caught(() => deleteNote(db, w.staffA, managers.id))).toMatchObject({ status: 403 });
    await deleteNote(db, w.staffA, mine.id);
    const deleted = await db.note.findUniqueOrThrow({ where: { id: mine.id } });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.deletedById).toBe(w.staffA.id);
  });
});

describe('elevated roles', () => {
  it('manager sees and edits every customer and task', async () => {
    const w = await world();
    expect((await listCustomers(db, w.manager, {})).customers).toHaveLength(2);
    const updated = await updateCustomer(db, w.manager, w.customerB.id, { city: 'אילת' });
    expect(updated.city).toBe('אילת');
    const priced = await updateTask(db, w.manager, w.taskB.id, { version: w.taskB.version, priceAgorot: 120_000 });
    expect(priced.price).toMatchObject({ net: 120_000, vat: 21_600, rateBps: 1800 });
  });

  it('archive and restore require permission, and restore requires the archive permission too', async () => {
    const w = await world();
    expect(await caught(() => archiveCustomer(db, w.staffA, w.customerA.id, null))).toMatchObject({ status: 403 });
    await archiveCustomer(db, w.manager, w.customerA.id, 'עבר ספק');
    expect((await listCustomers(db, w.staffA, {})).customers).toHaveLength(0);
    expect(await caught(() => listArchivedCustomers(db, w.staffA))).toMatchObject({ status: 403 });
    expect(await caught(() => restoreCustomer(db, w.staffA, w.customerA.id, 'חזר'))).toMatchObject({ status: 403 });
    await restoreCustomer(db, w.manager, w.customerA.id, 'חזר אלינו');
    expect((await listCustomers(db, w.staffA, {})).customers).toHaveLength(1);
  });
});

describe('admin-only operations', () => {
  it('are refused for staff and managers', async () => {
    const w = await world();
    for (const actor of [w.staffA, w.manager]) {
      expect(await caught(() => listAuditEvents(db, actor, {}))).toMatchObject({ status: 403 });
      expect(await caught(() => listSettings(db, actor))).toMatchObject({ status: 403 });
      expect(await caught(() => updateSetting(db, actor, 'vat.default_rate_bps', 1700))).toMatchObject({ status: 403 });
    }
    expect(await caught(() => listUsers(db, w.staffA))).toMatchObject({ status: 403 });
    expect(await caught(() => getRevenueReport(db, w.staffA, { year: 2026, month: 1 }))).toMatchObject({ status: 403 });
    expect(await caught(() => closeRevenueMonth(db, w.admin, { year: 2026, month: 1 }))).toMatchObject({ status: 403 });
  });

  it('settings reject unknown keys and invalid values', async () => {
    const w = await world();
    expect(await caught(() => updateSetting(db, w.admin, '__proto__', 1))).toMatchObject({ status: 404 });
    expect(await caught(() => updateSetting(db, w.admin, 'vat.default_rate_bps', 'eighteen'))).toMatchObject({ category: 'validation' });
    expect(await caught(() => updateSetting(db, w.admin, 'vat.default_rate_bps', 99_999))).toMatchObject({ category: 'validation' });
  });
});

describe('list sorting', () => {
  it('never widens scope, and cursor pages under a tied sort return every row exactly once', async () => {
    const w = await world();
    const byCity = await listCustomers(db, w.staffA, { sort: 'city', dir: 'desc' });
    expect(byCity.customers.map((c) => c.id)).toEqual([w.customerA.id]);

    // 60 customers, all in the same city: the sort key ties for every row.
    for (let i = 0; i < 60; i += 1) await makeCustomer(w.manager, w.manager, `לקוח ${String(i).padStart(2, '0')}`);
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await listCustomers(db, w.manager, { sort: 'city', dir: 'asc', cursor });
      seen.push(...page.customers.map((c) => c.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toHaveLength(62);
    expect(new Set(seen).size).toBe(62);

    const newestFirst = await listCustomers(db, w.manager, { sort: 'createdAt', dir: 'desc' });
    expect(newestFirst.customers[0]!.name).toBe('לקוח 59');
  });
});
