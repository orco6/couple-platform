/**
 * Period close, reopen, and authoritative snapshots.
 *
 * THE PATTERN (from Koma's payroll close)
 *   While a period is open, figures are calculated live from current data.
 *   Closing it computes the figures once and stores them as snapshots. From
 *   then on the closed period is READ from the snapshot, never recalculated —
 *   so a later settings change, a corrected rule, or a change to the
 *   calculation code cannot silently rewrite what was already paid or reported.
 *
 *   Writes that would change a closed period's figures are refused
 *   (`assertPeriodOpen`), for everyone including administrators. Changing one
 *   means reopening, which requires a reason and is audited. Re-closing writes
 *   new snapshots and marks the old ones superseded — both remain.
 *
 * CONCURRENCY
 *   A write to a period takes a SHARED advisory lock on (scope, period) inside
 *   its transaction; closing takes an EXCLUSIVE one. A close therefore waits for
 *   in-flight writes to commit, and writes arriving during a close wait for it
 *   and then see CLOSED. No write can land between "calculated" and "stored".
 */

import type { Prisma } from '@/generated/prisma/client';
import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { recordAudit } from '@/core/audit/record';
import { copy } from '@/core/copy';
import { formatPeriod, isValidPeriod, type Period } from '@/core/dates/period';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';

export interface PeriodState {
  scope: string;
  period: Period;
  isClosed: boolean;
  closedAt: string | null;
  closedByName: string | null;
  reopenedAt: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
}

function lockKey(scope: string, period: Period): string {
  return `period:${scope}:${period.year}-${period.month}`;
}

async function sharedLock(tx: Prisma.TransactionClient, scope: string, period: Period) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${lockKey(scope, period)}, 0))`;
}

async function exclusiveLock(tx: Prisma.TransactionClient, scope: string, period: Period) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey(scope, period)}, 0))`;
}

export async function getPeriodState(client: DbClient, scope: string, period: Period): Promise<PeriodState> {
  const row = await client.periodLock.findUnique({
    where: { scope_year_month: { scope, year: period.year, month: period.month } },
    include: { closedBy: { select: { name: true } }, reopenedBy: { select: { name: true } } },
  });
  return {
    scope,
    period,
    isClosed: row?.status === 'CLOSED',
    closedAt: row?.closedAt?.toISOString() ?? null,
    closedByName: row?.closedBy?.name ?? null,
    reopenedAt: row?.reopenedAt?.toISOString() ?? null,
    reopenedByName: row?.reopenedBy?.name ?? null,
    reopenReason: row?.reopenReason ?? null,
  };
}

/**
 * Call inside the SAME transaction as the write, for every period the write
 * affects (e.g. both the old and the new completion month when a date moves).
 */
export async function assertPeriodOpen(tx: Prisma.TransactionClient, scope: string, period: Period | null): Promise<void> {
  if (!period) return;
  await sharedLock(tx, scope, period);
  const row = await tx.periodLock.findUnique({
    where: { scope_year_month: { scope, year: period.year, month: period.month } },
    select: { status: true },
  });
  if (row?.status === 'CLOSED') {
    throw errors.businessRule('PERIOD_CLOSED', copy.periods.closed(formatPeriod(period)));
  }
}

export interface SnapshotInput {
  kind: string;
  subjectType?: string | null;
  subjectId?: string | null;
  calculationVersion: number;
  data: Prisma.InputJsonValue;
}

export async function closePeriod(
  client: DbClient,
  actor: Actor,
  scope: string,
  period: Period,
  buildSnapshots: (tx: Prisma.TransactionClient) => Promise<SnapshotInput[]>,
): Promise<PeriodState> {
  assertCan(actor, 'periods.close');
  if (!isValidPeriod(period)) throw errors.validation();

  await inTransaction(client, async (tx) => {
    await exclusiveLock(tx, scope, period);

    const existing = await tx.periodLock.findUnique({
      where: { scope_year_month: { scope, year: period.year, month: period.month } },
      select: { status: true },
    });
    if (existing?.status === 'CLOSED') throw errors.businessRule('PERIOD_ALREADY_CLOSED', copy.periods.alreadyClosed);

    const snapshots = await buildSnapshots(tx);
    const now = new Date();
    const kinds = [...new Set(snapshots.map((snapshot) => snapshot.kind))];

    if (kinds.length > 0) {
      await tx.snapshot.updateMany({
        where: { kind: { in: kinds }, periodYear: period.year, periodMonth: period.month, supersededAt: null },
        data: { supersededAt: now },
      });
    }
    if (snapshots.length > 0) {
      await tx.snapshot.createMany({
        data: snapshots.map((snapshot) => ({
          kind: snapshot.kind,
          periodYear: period.year,
          periodMonth: period.month,
          subjectType: snapshot.subjectType ?? null,
          subjectId: snapshot.subjectId ?? null,
          calculationVersion: snapshot.calculationVersion,
          data: snapshot.data,
          createdById: actor.id,
          createdAt: now,
        })),
      });
    }

    const lock = await tx.periodLock.upsert({
      where: { scope_year_month: { scope, year: period.year, month: period.month } },
      update: { status: 'CLOSED', closedAt: now, closedById: actor.id },
      create: { scope, year: period.year, month: period.month, status: 'CLOSED', closedAt: now, closedById: actor.id },
    });

    await recordAudit(tx, {
      actor,
      action: 'period.closed',
      entityType: 'period',
      entityId: lock.id,
      after: { status: 'CLOSED' },
      metadata: { scope, period: `${period.year}-${period.month}`, snapshotCount: snapshots.length },
    });
  });

  return getPeriodState(client, scope, period);
}

export async function reopenPeriod(
  client: DbClient,
  actor: Actor,
  scope: string,
  period: Period,
  reason: string,
): Promise<PeriodState> {
  assertCan(actor, 'periods.close');
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw errors.validation(copy.periods.reasonRequired, { reason: copy.periods.reasonRequired });

  await inTransaction(client, async (tx) => {
    await exclusiveLock(tx, scope, period);
    const row = await tx.periodLock.findUnique({
      where: { scope_year_month: { scope, year: period.year, month: period.month } },
    });
    if (row?.status !== 'CLOSED') throw errors.businessRule('PERIOD_ALREADY_OPEN', copy.periods.alreadyOpen);

    // Snapshots are kept: they are the record of what the closed period said.
    await tx.periodLock.update({
      where: { id: row.id },
      data: { status: 'OPEN', reopenedAt: new Date(), reopenedById: actor.id, reopenReason: trimmed },
    });
    await recordAudit(tx, {
      actor,
      action: 'period.reopened',
      entityType: 'period',
      entityId: row.id,
      before: { status: 'CLOSED' },
      after: { status: 'OPEN' },
      reason: trimmed,
      metadata: { scope, period: `${period.year}-${period.month}` },
    });
  });

  return getPeriodState(client, scope, period);
}

/** Current (non-superseded) snapshots of a kind for a period. */
export async function readSnapshots(client: DbClient, kind: string, period: Period) {
  return client.snapshot.findMany({
    where: { kind, periodYear: period.year, periodMonth: period.month, supersededAt: null },
    orderBy: { createdAt: 'asc' },
  });
}
