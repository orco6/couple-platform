/**
 * Periods — a calendar month identified by (year, month).
 *
 * Deliberately not a Date: "August 2026" is not a point in time, and storing it
 * as a pair means a person in Israel and a server in UTC always agree on which
 * month something belongs to.
 */

import { businessLocale } from '@/brand/brand';
import { parts, todayIn, type CalendarDate } from './calendar-date';

export interface Period {
  year: number;
  /** 1–12 */
  month: number;
}

export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
] as const;

export function isValidPeriod(value: Period): boolean {
  return (
    Number.isInteger(value.year) &&
    Number.isInteger(value.month) &&
    value.year >= 2000 &&
    value.year <= 2100 &&
    value.month >= 1 &&
    value.month <= 12
  );
}

export function currentPeriod(timeZone: string = businessLocale.timeZone, now = new Date()): Period {
  const { year, month } = parts(todayIn(timeZone, now));
  return { year, month };
}

export function periodOf(date: CalendarDate): Period {
  const { year, month } = parts(date);
  return { year, month };
}

export function addMonths(period: Period, delta: number): Period {
  const index = periodIndex(period) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/** A single sortable integer: one comparison for "is X within range". */
export function periodIndex(period: Period): number {
  return period.year * 12 + (period.month - 1);
}

export function comparePeriods(a: Period, b: Period): number {
  return periodIndex(a) - periodIndex(b);
}

/** "2026-08": sortable, URL-safe, log-safe. */
export function periodKey(period: Period): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

export function parsePeriodKey(input: string | undefined | null): Period | null {
  const match = /^(\d{4})-(\d{2})$/.exec(input ?? '');
  if (!match) return null;
  const candidate = { year: Number(match[1]), month: Number(match[2]) };
  return isValidPeriod(candidate) ? candidate : null;
}

/** First day (inclusive) and the first day of the next month (exclusive). */
export function periodBounds(period: Period): { start: CalendarDate; endExclusive: CalendarDate } {
  const next = addMonths(period, 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    start: `${period.year}-${pad(period.month)}-01` as CalendarDate,
    endExclusive: `${next.year}-${pad(next.month)}-01` as CalendarDate,
  };
}

/** "אוגוסט 2026". Month names are fixed strings, not ICU data that can change. */
export function formatPeriod(period: Period): string {
  return `${HEBREW_MONTHS[period.month - 1]} ${period.year}`;
}
