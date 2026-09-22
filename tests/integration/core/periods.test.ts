/**
 * Period close / reopen / snapshots and period locks, with a synthetic ledger —
 * no business domain required. Includes the races the design claims to prevent.
 */

import { describe, expect, it } from 'vitest';
import { inTransaction } from '@/core/db/transaction';
import { db } from '@/core/db/client';
import { assertPeriodOpen, closePeriod, getPeriodState, readSnapshots, reopenPeriod } from '@/core/periods/periods';
import { caught, makeUser } from '../../support/factories';
import { topRole, unprivilegedRole } from '../../support/roles';
import { rolesWith, rolesWithout } from '@/core/access/role-queries';

const SCOPE = 'test-ledger';
const PERIOD = { year: 2026, month: 3 };
const snapshotOf = (total: number) => async () => [{ kind: 'test.total', calculationVersion: 1, data: { total } }];

describe('period close and snapshots', () => {
  it('closes with snapshots, refuses writes inside the period, reopens only with a reason, re-close supersedes', async () => {
    const owner = await makeUser({ role: topRole() });

    await closePeriod(db, owner, SCOPE, PERIOD, snapshotOf(100));
    expect((await getPeriodState(db, SCOPE, PERIOD)).isClosed).toBe(true);
    expect(await caught(() => inTransaction(db, (tx) => assertPeriodOpen(tx, SCOPE, PERIOD)))).toMatchObject({ code: 'PERIOD_CLOSED' });
    // Other periods and other scopes are unaffected.
    await inTransaction(db, (tx) => assertPeriodOpen(tx, SCOPE, { year: 2026, month: 4 }));
    await inTransaction(db, (tx) => assertPeriodOpen(tx, 'other-ledger', PERIOD));

    expect(await caught(() => closePeriod(db, owner, SCOPE, PERIOD, snapshotOf(1)))).toMatchObject({ code: 'PERIOD_ALREADY_CLOSED' });
    expect(await caught(() => reopenPeriod(db, owner, SCOPE, PERIOD, ' '))).toMatchObject({ category: 'validation' });

    await reopenPeriod(db, owner, SCOPE, PERIOD, 'חשבונית תוקנה');
    await inTransaction(db, (tx) => assertPeriodOpen(tx, SCOPE, PERIOD));
    await closePeriod(db, owner, SCOPE, PERIOD, snapshotOf(120));

    const current = await readSnapshots(db, 'test.total', PERIOD);
    expect(current.map((s) => s.data)).toEqual([{ total: 120 }]);
    expect(await db.snapshot.count()).toBe(2); // the first close is kept, superseded
    expect((await db.auditEvent.findFirstOrThrow({ where: { action: 'period.reopened' } })).reason).toBe('חשבונית תוקנה');
  });

  it('snapshots are evidence: changing the calculation later does not change what was stored', async () => {
    const owner = await makeUser({ role: topRole() });
    await closePeriod(db, owner, SCOPE, PERIOD, snapshotOf(100));
    // "New code" would compute 999 — but the closed period is read, not recalculated.
    expect((await readSnapshots(db, 'test.total', PERIOD))[0]?.data).toEqual({ total: 100 });
  });

  it('closing and reopening require periods.close', async () => {
    const withoutClose = rolesWithout('periods.close')[0];
    const actor = await makeUser({ role: withoutClose ?? unprivilegedRole() });
    expect(await caught(() => closePeriod(db, actor, SCOPE, PERIOD, snapshotOf(1)))).toMatchObject({ status: 403 });
    const owner = await makeUser({ role: rolesWith('periods.close')[0] ?? topRole() });
    await closePeriod(db, owner, SCOPE, PERIOD, snapshotOf(1));
    expect(await caught(() => reopenPeriod(db, actor, SCOPE, PERIOD, 'ניסיון'))).toMatchObject({ status: 403 });
  });

  it('two simultaneous closes: exactly one succeeds and one snapshot set exists', async () => {
    const owner = await makeUser({ role: topRole() });
    const results = await Promise.allSettled([
      closePeriod(db, owner, SCOPE, PERIOD, snapshotOf(1)),
      closePeriod(db, owner, SCOPE, PERIOD, snapshotOf(2)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.snapshot.count({ where: { supersededAt: null } })).toBe(1);
  });

  it('a write in flight blocks the close until it commits; nothing lands between "calculated" and "stored"', async () => {
    const owner = await makeUser({ role: topRole() });
    const order: string[] = [];
    let writeCommitted = false;

    const write = inTransaction(db, async (tx) => {
      await assertPeriodOpen(tx, SCOPE, PERIOD);
      order.push('write-checked');
      await new Promise((resolve) => setTimeout(resolve, 300));
      order.push('write-committing');
    }).then(() => {
      writeCommitted = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const close = closePeriod(db, owner, SCOPE, PERIOD, async () => {
      order.push(`close-calculating (write committed: ${writeCommitted})`);
      return [{ kind: 'test.total', calculationVersion: 1, data: { total: 1 } }];
    });

    await Promise.all([write, close]);
    expect(order).toEqual(['write-checked', 'write-committing', 'close-calculating (write committed: true)']);

    // And after the close, a new write is refused.
    expect(await caught(() => inTransaction(db, (tx) => assertPeriodOpen(tx, SCOPE, PERIOD)))).toMatchObject({ code: 'PERIOD_CLOSED' });
  });
});
