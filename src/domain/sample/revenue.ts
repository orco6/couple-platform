/**
 * SAMPLE DOMAIN — monthly revenue by assignee, with period close.
 *
 * The calculation is a pure function (tested in isolation). While a month is
 * open it runs live over DONE tasks whose completedOn falls in that month.
 * Closing the month stores its result as snapshots; a closed month is read back
 * from them and never recalculated.
 */

import { z } from 'zod';
import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { toDbDate } from '@/core/dates/calendar-date';
import { periodBounds, type Period } from '@/core/dates/period';
import type { DbClient } from '@/core/db/types';
import { sumMinor, type Minor } from '@/core/money/money';
import { vatFromNet } from '@/core/money/vat';
import { closePeriod, getPeriodState, readSnapshots, reopenPeriod, type PeriodState } from '@/core/periods/periods';
import { REVENUE_SCOPE } from './tasks';

export const REVENUE_CALCULATION_VERSION = 1;
const SNAPSHOT_KIND = 'revenue.monthly_by_assignee';

export interface RevenueInputTask {
  id: string;
  assigneeId: string | null;
  assigneeName: string | null;
  priceAgorot: Minor | null;
  vatRateBps: number | null;
}

const lineSchema = z.object({
  assigneeId: z.string().nullable(),
  assigneeName: z.string(),
  taskCount: z.number().int(),
  unpricedCount: z.number().int(),
  net: z.number().int(),
  vat: z.number().int(),
  gross: z.number().int(),
  taskIds: z.array(z.string()),
});

export type RevenueLine = z.infer<typeof lineSchema>;

export interface RevenueReport {
  period: Period;
  state: PeriodState;
  source: 'live' | 'snapshot';
  calculationVersion: number;
  lines: RevenueLine[];
  totals: { taskCount: number; unpricedCount: number; net: Minor; vat: Minor; gross: Minor };
}

const UNASSIGNED = 'ללא מבצע';

/** Pure. Groups by assignee; VAT per task at the rate frozen on that task, then summed. */
export function calculateRevenue(tasks: readonly RevenueInputTask[]): RevenueLine[] {
  const groups = new Map<string, RevenueLine>();
  for (const task of tasks) {
    const key = task.assigneeId ?? '__unassigned__';
    const line = groups.get(key) ?? {
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName ?? UNASSIGNED,
      taskCount: 0,
      unpricedCount: 0,
      net: 0,
      vat: 0,
      gross: 0,
      taskIds: [],
    };
    line.taskCount += 1;
    line.taskIds.push(task.id);
    if (task.priceAgorot === null || task.vatRateBps === null) {
      line.unpricedCount += 1;
    } else {
      const breakdown = vatFromNet(task.priceAgorot, task.vatRateBps);
      line.net += breakdown.net;
      line.vat += breakdown.vat;
      line.gross += breakdown.gross;
    }
    groups.set(key, line);
  }
  return [...groups.values()].sort((a, b) => b.gross - a.gross || a.assigneeName.localeCompare(b.assigneeName, 'he'));
}

function totalsOf(lines: readonly RevenueLine[]) {
  return {
    taskCount: lines.reduce((total, line) => total + line.taskCount, 0),
    unpricedCount: lines.reduce((total, line) => total + line.unpricedCount, 0),
    net: sumMinor(lines.map((line) => line.net)),
    vat: sumMinor(lines.map((line) => line.vat)),
    gross: sumMinor(lines.map((line) => line.gross)),
  };
}

async function loadInputs(client: DbClient, period: Period): Promise<RevenueInputTask[]> {
  const { start, endExclusive } = periodBounds(period);
  const rows = await client.task.findMany({
    where: { status: 'DONE', completedOn: { gte: toDbDate(start), lt: toDbDate(endExclusive) } },
    select: { id: true, assigneeId: true, priceAgorot: true, vatRateBps: true, assignee: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.name ?? null,
    priceAgorot: row.priceAgorot,
    vatRateBps: row.vatRateBps,
  }));
}

export async function getRevenueReport(client: DbClient, actor: Actor, period: Period): Promise<RevenueReport> {
  assertCan(actor, 'reports.revenue');
  const state = await getPeriodState(client, REVENUE_SCOPE, period);

  if (state.isClosed) {
    const snapshots = await readSnapshots(client, SNAPSHOT_KIND, period);
    const lines = snapshots.map((snapshot) => lineSchema.parse(snapshot.data));
    return {
      period,
      state,
      source: 'snapshot',
      calculationVersion: snapshots[0]?.calculationVersion ?? REVENUE_CALCULATION_VERSION,
      lines,
      totals: totalsOf(lines),
    };
  }

  const lines = calculateRevenue(await loadInputs(client, period));
  return { period, state, source: 'live', calculationVersion: REVENUE_CALCULATION_VERSION, lines, totals: totalsOf(lines) };
}

export async function closeRevenueMonth(client: DbClient, actor: Actor, period: Period) {
  assertCan(actor, 'reports.revenue');
  return closePeriod(client, actor, REVENUE_SCOPE, period, async (tx) => {
    const lines = calculateRevenue(await loadInputs(tx, period));
    return lines.map((line) => ({
      kind: SNAPSHOT_KIND,
      subjectType: line.assigneeId ? 'user' : null,
      subjectId: line.assigneeId,
      calculationVersion: REVENUE_CALCULATION_VERSION,
      data: line,
    }));
  });
}

export async function reopenRevenueMonth(client: DbClient, actor: Actor, period: Period, reason: string) {
  assertCan(actor, 'reports.revenue');
  return reopenPeriod(client, actor, REVENUE_SCOPE, period, reason);
}
