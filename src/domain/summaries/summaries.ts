/**
 * THE SUMMARIES — שנינו. BUSINESS_RULES.md §9.
 *
 * Weekly, ending Saturday (the Hebrew week runs Sunday → Saturday, so Saturday
 * IS the end-of-week review the product is built around). Monthly, as four or
 * five of those weeks side by side.
 *
 * R-SUM-02 — a summary never leaks an unrevealed rating. Every relationship
 * figure is built from `listRangeDays`, which already withholds the partner's
 * values on unrevealed dates, so there is no second place where the reveal rule
 * has to be remembered.
 *
 * There is deliberately no "partner's respect average" figure. Over a range
 * containing unrevealed days it could only be an average of the revealed
 * subset — a different statistic from "my average", with a different
 * denominator, shown next to it under a similar label. Two figures that look
 * comparable and are not is how a summary starts lying.
 *
 * Nothing here is snapshotted or locked (D-4): every figure is recomputed from
 * the rows, so an amended entry or a late rating cannot leave a stale number
 * behind.
 */

import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { addDays, compareCalendarDates, parts, todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import type { DbClient } from '@/core/db/types';

import { listRangeDays, type RangeDay } from '../day-entries/day-entries';
import { partnersOf, type PartnerRef } from '../partners';
import { listTasksInRange, type TaskSummaryRow } from '../tasks/tasks';
import {
  bestDay,
  closedTogetherStreak,
  completion,
  coupleRespectAverage,
  daysClosedTogether,
  executionAverage,
  myRespectAverage,
  trend,
  unratedCompletedCount,
  weeklyInsight,
  type Completion,
  type Insight,
  type TrendDirection,
} from './calculations';

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
 * The Hebrew week: Sunday to Saturday. `getUTCDay` is read on a date built from
 * the calendar parts, never on a local Date, so the answer does not depend on
 * the server's timezone.
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

/** The anchor for the previous/next range, for the stepper. */
export function shiftWeek(anchor: CalendarDate, delta: -1 | 1): CalendarDate {
  const bounds = weekBounds(anchor);
  return delta === 1 ? bounds.toExclusive : addDays(bounds.from, -1);
}

export function shiftMonth(anchor: CalendarDate, delta: -1 | 1): CalendarDate {
  const bounds = monthBounds(anchor);
  return delta === 1 ? bounds.toExclusive : addDays(bounds.from, -1);
}

/* ── Loading a range ──────────────────────────────────────────────────── */

async function loadRange(
  client: DbClient,
  actor: Actor,
  bounds: RangeBounds,
): Promise<{ days: RangeDay[]; tasks: TaskSummaryRow[] }> {
  const [days, tasks] = await Promise.all([
    listRangeDays(client, actor, bounds.from, bounds.toExclusive),
    listTasksInRange(client, actor, bounds.from, bounds.toExclusive),
  ]);
  return { days, tasks };
}

/* ── The week ─────────────────────────────────────────────────────────── */

export interface WeekSummary {
  from: CalendarDate;
  toExclusive: CalendarDate;
  me: PartnerRef;
  partner: PartnerRef | null;

  completion: Completion;
  executionAverage: number | null;
  respectAverage: number | null;
  myRespectAverage: number | null;

  days: RangeDay[];
  streak: number;
  daysClosedTogether: number;
  bestDay: { date: string; average: number } | null;
  unratedCompleted: number;
  /** Completed, rated 5, and worth naming. */
  perfectTaskTitle: string | null;

  insight: Insight;
  isEmpty: boolean;
}

export async function getWeekSummary(
  client: DbClient,
  actor: Actor,
  anchor: CalendarDate,
  now: Date = new Date(),
): Promise<WeekSummary> {
  assertCan(actor, 'summaries.read');

  const bounds = weekBounds(anchor);
  const [{ me, other }, { days, tasks }] = await Promise.all([
    partnersOf(client, actor),
    loadRange(client, actor, bounds),
  ]);

  const done = completion(tasks, actor.id);
  // Completed, for the same reason the average is (R-CALC-02): a 5 on a task
  // that has gone back to open is not a highlight of this week's work.
  const perfect = tasks.find((task) => task.completedById !== null && task.ratingValue === 5);

  return {
    from: bounds.from,
    toExclusive: bounds.toExclusive,
    me,
    partner: other,
    completion: done,
    executionAverage: executionAverage(tasks),
    respectAverage: coupleRespectAverage(days),
    myRespectAverage: myRespectAverage(days),
    days,
    streak: closedTogetherStreak(days, todayIn(undefined, now)),
    daysClosedTogether: daysClosedTogether(days),
    bestDay: bestDay(days),
    unratedCompleted: unratedCompletedCount(tasks),
    perfectTaskTitle: perfect?.title ?? null,
    insight: weeklyInsight({ tasks, days, completion: done, myId: actor.id }),
    isEmpty: tasks.length === 0 && days.every((day) => day.mine === null && !day.partnerSubmitted),
  };
}

/* ── The month ────────────────────────────────────────────────────────── */

export interface WeekPoint {
  /** 1-based index within the month, for the label. */
  index: number;
  from: CalendarDate;
  completionPercent: number | null;
  executionAverage: number | null;
  respectAverage: number | null;
}

export interface MonthSummary {
  from: CalendarDate;
  toExclusive: CalendarDate;
  me: PartnerRef;
  partner: PartnerRef | null;

  weeks: WeekPoint[];
  /** Every day of the month, with the same reveal rule as the week (R-DAY-05). */
  days: RangeDay[];
  completion: Completion;
  executionAverage: number | null;
  respectAverage: number | null;

  completionTrend: TrendDirection;
  respectTrend: TrendDirection;
  isEmpty: boolean;
}

/**
 * The month, as its weeks.
 *
 * The weeks are the month's own calendar weeks clipped to it, so the first and
 * last are usually short. That is the honest shape: a "week 1" that borrowed
 * three days from the previous month would make the trend line disagree with
 * the weekly summary those days already appeared in.
 */
export async function getMonthSummary(
  client: DbClient,
  actor: Actor,
  anchor: CalendarDate,
): Promise<MonthSummary> {
  assertCan(actor, 'summaries.read');

  const bounds = monthBounds(anchor);
  const [{ me, other }, { days, tasks }] = await Promise.all([
    partnersOf(client, actor),
    loadRange(client, actor, bounds),
  ]);

  // Walk the month in calendar weeks, clipped at both ends.
  const weeks: WeekPoint[] = [];
  let cursor = bounds.from;
  let index = 1;
  while (compareCalendarDates(cursor, bounds.toExclusive) < 0) {
    const week = weekBounds(cursor);
    const from = compareCalendarDates(week.from, bounds.from) < 0 ? bounds.from : week.from;
    const toExclusive =
      compareCalendarDates(week.toExclusive, bounds.toExclusive) > 0 ? bounds.toExclusive : week.toExclusive;

    const weekDays = days.filter(
      (day) => compareCalendarDates(day.date, from) >= 0 && compareCalendarDates(day.date, toExclusive) < 0,
    );
    const weekTasks = tasks.filter(
      (task) =>
        compareCalendarDates(task.taskDate, from) >= 0 && compareCalendarDates(task.taskDate, toExclusive) < 0,
    );

    weeks.push({
      index,
      from,
      completionPercent: completion(weekTasks, actor.id).percent,
      executionAverage: executionAverage(weekTasks),
      respectAverage: coupleRespectAverage(weekDays),
    });

    cursor = toExclusive;
    index += 1;
  }

  const done = completion(tasks, actor.id);

  return {
    from: bounds.from,
    toExclusive: bounds.toExclusive,
    me,
    partner: other,
    weeks,
    days,
    completion: done,
    executionAverage: executionAverage(tasks),
    respectAverage: coupleRespectAverage(days),
    completionTrend: trend(
      weeks.map((week) => week.completionPercent),
      // Percentages need a wider dead band than a 1–5 average.
      8,
    ),
    respectTrend: trend(weeks.map((week) => week.respectAverage)),
    isEmpty: tasks.length === 0 && days.every((day) => day.mine === null && !day.partnerSubmitted),
  };
}
