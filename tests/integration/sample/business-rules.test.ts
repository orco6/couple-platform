/** SAMPLE DOMAIN business rules on a real database — delete with the sample. */

import { describe, expect, it } from 'vitest';
import { addDays, todayIn } from '@/core/dates/calendar-date';
import { currentPeriod, periodOf } from '@/core/dates/period';
import { db } from '@/core/db/client';
import { updateSetting } from '@/core/settings/settings';
import { closeRevenueMonth, getRevenueReport, reopenRevenueMonth } from '@/domain/sample/revenue';
import { getTask, transitionTask, updateTask } from '@/domain/sample/tasks';
import { caught, makeUser } from '../../support/factories';
import { makeCustomer, makeTask } from './factories';

async function pricedDoneTask(completedDaysAgo = 0) {
  const owner = await makeUser({ role: 'OWNER' });
  const customer = await makeCustomer(owner);
  const task = await makeTask(customer.id, owner, { assigneeId: owner.id, priceAgorot: 100_000 });
  const completedOn = addDays(todayIn(), -completedDaysAgo);
  const done = await transitionTask(db, owner, task.id, { version: task.version, to: 'DONE', completedOn });
  return { owner, task: done, period: periodOf(completedOn) };
}

describe('period close and snapshots', () => {
  it('a closed month is read from its snapshot, not recalculated', async () => {
    const { owner, task, period } = await pricedDoneTask();
    await closeRevenueMonth(db, owner, period);

    // Change the underlying data behind the snapshot's back (as a bug or a migration might).
    await db.task.update({ where: { id: task.id }, data: { priceAgorot: 999_999 } });

    const report = await getRevenueReport(db, owner, period);
    expect(report.source).toBe('snapshot');
    expect(report.totals.gross).toBe(118_000);
    expect(await db.snapshot.count({ where: { supersededAt: null } })).toBe(1);
  });

  it('refuses changes that would alter a closed month — for everyone, including the owner', async () => {
    const { owner, task, period } = await pricedDoneTask();
    const openView = await getTask(db, owner, task.id);
    expect(openView.lockedPeriod).toBeNull();
    expect(openView.permissions.transitions.length).toBeGreaterThan(0);
    await closeRevenueMonth(db, owner, period);

    // The detail view offers exactly what the server will accept: no status, price or assignee changes.
    const lockedView = await getTask(db, owner, task.id);
    expect(lockedView.lockedPeriod).not.toBeNull();
    expect(lockedView.permissions).toMatchObject({ edit: true, setPrice: false, reassign: false, transitions: [] });

    expect(await caught(() => updateTask(db, owner, task.id, { version: task.version, priceAgorot: 50_000 }))).toMatchObject({ code: 'PERIOD_CLOSED' });
    expect(await caught(() => transitionTask(db, owner, task.id, { version: task.version, to: 'IN_PROGRESS', reason: 'לבדוק שוב' }))).toMatchObject({ code: 'PERIOD_CLOSED' });
    // Non-financial edits are still allowed.
    const renamed = await updateTask(db, owner, task.id, { version: task.version, title: 'כותרת מתוקנת' });
    expect(renamed.title).toBe('כותרת מתוקנת');
  });

  it('reopening requires a reason, is audited, and re-closing supersedes (never deletes) snapshots', async () => {
    const { owner, period } = await pricedDoneTask();
    await closeRevenueMonth(db, owner, period);
    expect(await caught(() => reopenRevenueMonth(db, owner, period, ' '))).toMatchObject({ category: 'validation' });
    await reopenRevenueMonth(db, owner, period, 'חשבונית תוקנה');
    expect((await getRevenueReport(db, owner, period)).source).toBe('live');
    await closeRevenueMonth(db, owner, period);

    expect(await db.snapshot.count()).toBe(2);
    expect(await db.snapshot.count({ where: { supersededAt: null } })).toBe(1);
    const reopen = await db.auditEvent.findFirstOrThrow({ where: { action: 'period.reopened' } });
    expect(reopen.reason).toBe('חשבונית תוקנה');
    expect(await caught(() => closeRevenueMonth(db, owner, period))).toMatchObject({ code: 'PERIOD_ALREADY_CLOSED' });
  });

  it('a completion date moving INTO a closed month is refused', async () => {
    const owner = await makeUser({ role: 'OWNER' });
    const customer = await makeCustomer(owner);
    const period = currentPeriod();
    await closeRevenueMonth(db, owner, period);
    const task = await makeTask(customer.id, owner, { priceAgorot: 10_000 });
    expect(await caught(() => transitionTask(db, owner, task.id, { version: task.version, to: 'DONE' }))).toMatchObject({ code: 'PERIOD_CLOSED' });
  });

  it('refuses a completion date in the future', async () => {
    const owner = await makeUser({ role: 'OWNER' });
    const task = await makeTask((await makeCustomer(owner)).id, owner);
    expect(await caught(() => transitionTask(db, owner, task.id, { version: task.version, to: 'DONE', completedOn: addDays(todayIn(), 2) }))).toMatchObject({ category: 'validation' });
  });
});

describe('money and history on the record', () => {
  it('freezes the VAT rate on the task: a later settings change does not rewrite past prices', async () => {
    const owner = await makeUser({ role: 'OWNER' });
    const customer = await makeCustomer(owner);
    const task = await makeTask(customer.id, owner, { priceAgorot: 100_000 });
    await updateSetting(db, owner, 'vat.default_rate_bps', 1900);
    const fresh = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(fresh.vatRateBps).toBe(1800);
  });

  it('optimistic concurrency: a stale edit is refused instead of overwriting', async () => {
    const owner = await makeUser({ role: 'OWNER' });
    const task = await makeTask((await makeCustomer(owner)).id, owner);
    await updateTask(db, owner, task.id, { version: task.version, title: 'עדכון ראשון' });
    expect(await caught(() => updateTask(db, owner, task.id, { version: task.version, title: 'עדכון מלשונית ישנה' }))).toMatchObject({ code: 'STALE_WRITE', status: 409 });
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).title).toBe('עדכון ראשון');
  });

  it('the database itself rejects impossible money states', async () => {
    const owner = await makeUser({ role: 'OWNER' });
    const task = await makeTask((await makeCustomer(owner)).id, owner);
    await expect(db.task.update({ where: { id: task.id }, data: { priceAgorot: -5, vatRateBps: 1800 } })).rejects.toThrow();
    await expect(db.task.update({ where: { id: task.id }, data: { priceAgorot: 100 } })).rejects.toThrow(); // price without rate
    await expect(db.task.update({ where: { id: task.id }, data: { status: 'DONE' } })).rejects.toThrow(); // DONE without completedOn
  });
});

describe('period lock covers every field that changes the month', () => {
  it('reassigning completed work in a closed month is refused (revenue is per assignee)', async () => {
    const owner = await makeUser({ role: 'OWNER' });
    const other = await makeUser({ role: 'STAFF' });
    const task = await makeTask((await makeCustomer(owner)).id, owner, { assigneeId: owner.id, priceAgorot: 10_000 });
    const completedOn = todayIn();
    const done = await transitionTask(db, owner, task.id, { version: task.version, to: 'DONE', completedOn });
    await closeRevenueMonth(db, owner, periodOf(completedOn));
    expect(await caught(() => updateTask(db, owner, task.id, { version: done.version, assigneeId: other.id }))).toMatchObject({ code: 'PERIOD_CLOSED' });
  });

  it('concurrent transitions of the same task: exactly one wins, the other gets STALE_WRITE', async () => {
    const owner = await makeUser({ role: 'OWNER' });
    const task = await makeTask((await makeCustomer(owner)).id, owner);
    const results = await Promise.allSettled([
      transitionTask(db, owner, task.id, { version: task.version, to: 'IN_PROGRESS' }),
      transitionTask(db, owner, task.id, { version: task.version, to: 'CANCELLED' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'STALE_WRITE' });
  });
});
