/**
 * THE SUMMARIES — שנינו. BUSINESS_RULES.md §9.
 *
 * R-SUM-02 — a summary never leaks an unrevealed rating. Every figure here is
 * built from `listRangeDays`, which already withholds the partner's values on
 * unrevealed dates, so there is no second place where the reveal rule has to be
 * remembered.
 *
 * One consequence worth stating: there is no "partner's average" figure. Over a
 * range containing unrevealed days it could only be an average of the revealed
 * subset — a different statistic from "my average", with a different
 * denominator, shown next to it under a similar label. Two figures that look
 * comparable and are not is how a summary starts lying. The couple average
 * (both closed) and my own average (all mine) are each answerable without a
 * caveat, and the chart draws both partners' days where they are revealed.
 *
 * Nothing here is snapshotted or locked (D-4): every figure is recomputed from
 * the rows, so an amended entry cannot leave a stale number behind.
 */

import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { addDays, parts, todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import type { DbClient } from '@/core/db/types';

import { listRangeDays, type RangeDay } from '../day-entries/day-entries';
import { partnersOf, type PartnerRef } from '../partners';
import { listTasksInRange } from '../tasks/tasks';
import {
  bestDay,
  closedTogetherStreak,
  coupleRangeAverage,
  daysClosedTogether,
  partnerRangeAverage,
  taskCompletion,
  type TaskCompletion,
} from './calculations';

export type RangeKind = 'week' | 'month';

export interface RangeBounds {
  from: CalendarDate;
  /** Exclusive, so every query is a half-open interval and no day is counted twice. */
  toExclusive: CalendarDate;
}

function utcDate(date: CalendarDate): Date {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The Hebrew week: Sunday to Saturday (BUSINESS_BRIEF §27). `getUTCDay` is
 * read on a date built from the calendar parts, never on a local Date, so the
 * answer does not depend on the server's timezone.
 */
export function weekBounds(anchor: CalendarDate): RangeBounds {
  const weekday = utcDate(anchor).getUTCDay();
  const from = addDays(anchor, -weekday);
  return { from, toExclusive: addDays(from, 7) };
}

export function monthBounds(anchor: CalendarDate): RangeBounds {
  const { year, month, day } = parts(anchor);
  const from = addDays(anchor, -(day - 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, toExclusive: addDays(from, daysInMonth) };
}

export function rangeBounds(kind: RangeKind, anchor: CalendarDate): RangeBounds {
  return kind === 'week' ? weekBounds(anchor) : monthBounds(anchor);
}

/** The anchor for the previous/next range, for the stepper. */
export function shiftAnchor(kind: RangeKind, anchor: CalendarDate, delta: -1 | 1): CalendarDate {
  const bounds = rangeBounds(kind, anchor);
  return delta === 1 ? bounds.toExclusive : addDays(bounds.from, -1);
}

export interface SummaryView {
  kind: RangeKind;
  from: CalendarDate;
  toExclusive: CalendarDate;
  me: PartnerRef;
  partner: PartnerRef | null;

  /** From the days both partners closed. Null when there are none. */
  coupleAverage: number | null;
  /** From every day I closed, revealed or not. */
  myAverage: number | null;

  days: RangeDay[];
  daysClosedTogether: number;
  streak: number;
  tasks: TaskCompletion;
  /** Month view only. */
  bestDay: { date: string; average: number } | null;

  /** True when nothing in the range has been closed by anyone. */
  isEmpty: boolean;
}

export async function getSummary(
  client: DbClient,
  actor: Actor,
  kind: RangeKind,
  anchor: CalendarDate,
  now: Date = new Date(),
): Promise<SummaryView> {
  assertCan(actor, 'summaries.read');

  const { from, toExclusive } = rangeBounds(kind, anchor);

  const [{ me, other }, days, tasks] = await Promise.all([
    partnersOf(client, actor),
    listRangeDays(client, actor, from, toExclusive),
    listTasksInRange(client, actor, from, toExclusive),
  ]);

  const myRatings = days.flatMap((day) => (day.mine ? [day.mine] : []));

  return {
    kind,
    from,
    toExclusive,
    me,
    partner: other,
    coupleAverage: coupleRangeAverage(days),
    myAverage: partnerRangeAverage(myRatings),
    days,
    daysClosedTogether: daysClosedTogether(days),
    streak: closedTogetherStreak(days, todayIn(undefined, now)),
    tasks: taskCompletion(tasks, actor.id),
    bestDay: kind === 'month' ? bestDay(days) : null,
    isEmpty: days.every((day) => day.mine === null && !day.partnerSubmitted),
  };
}
