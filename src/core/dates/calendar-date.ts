/**
 * Calendar dates — business days with no time and no timezone.
 *
 * RULES (docs/adr/0005-dates-and-time.md)
 *   • A business date (due date, payment date, completion day) is a
 *     CalendarDate: the string "YYYY-MM-DD". It is not a JS Date, because a
 *     Date is an instant and drags a timezone with it.
 *   • Stored in Postgres as DATE (@db.Date). Prisma hands those back as a Date
 *     at 00:00 UTC; convert with fromDbDate / toDbDate and read UTC parts only.
 *   • Shown to people as DD.MM.YYYY, zero-padded.
 *   • Parsed strictly. 31.04.2026 is rejected, never rolled into 1 May.
 *   • "Today" is always computed in the business timezone, never the server's.
 *   • createdAt/updatedAt are instants for bookkeeping, never business dates.
 */

import { businessLocale } from '@/brand/brand';

declare const calendarDateBrand: unique symbol;
export type CalendarDate = string & { readonly [calendarDateBrand]: true };

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2200;

function build(year: number, month: number, day: number): CalendarDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Date.UTC silently rolls 31.04 into 01.05. The only honest validity check is
  // to build it and confirm every part survived unchanged.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as CalendarDate;
}

/** Strict ISO "YYYY-MM-DD" (as sent by APIs and native date pickers). */
export function parseIsoDate(input: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!match) return null;
  return build(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  return typeof value === 'string' && parseIsoDate(value) === value;
}

/**
 * What a person types: day first, always. "03.04.2026" is the 3rd of April and
 * never the 4th of March. Separators . / - are accepted; a four-digit year is
 * required, because "03.04.26" is ambiguous about the century and guessing is
 * how a date ends up a hundred years out.
 */
export function parseIsraeliDate(input: string): CalendarDate | null {
  const cleaned = input.replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, '').trim();
  const match = /^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/.exec(cleaned);
  if (!match) return null;
  return build(Number(match[4]), Number(match[3]), Number(match[1]));
}

/** "2026-10-01" → "01.10.2026". */
export function formatCalendarDate(date: CalendarDate): string {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

/** Postgres DATE (Prisma: Date at 00:00 UTC) → CalendarDate. */
export function fromDbDate(value: Date): CalendarDate {
  const result = build(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (!result) throw new RangeError(`Invalid database date: ${value.toISOString()}`);
  return result;
}

export function fromDbDateOrNull(value: Date | null | undefined): CalendarDate | null {
  return value ? fromDbDate(value) : null;
}

/** CalendarDate → the Date Prisma writes to a DATE column. */
export function toDbDate(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function parts(date: CalendarDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

/** The calendar day it currently is in `timeZone` (default: the business's). */
export function todayIn(timeZone: string = businessLocale.timeZone, now: Date = new Date()): CalendarDate {
  return calendarDateOfInstant(now, timeZone);
}

/** Which calendar day an instant falls on, in a timezone. */
export function calendarDateOfInstant(instant: Date, timeZone: string = businessLocale.timeZone): CalendarDate {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(formatted.find((part) => part.type === type)?.value);
  const result = build(get('year'), get('month'), get('day'));
  if (!result) throw new RangeError('Could not resolve calendar date');
  return result;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const next = new Date(toDbDate(date).getTime() + days * 86_400_000);
  return fromDbDate(next);
}

/** Negative when a is earlier. Lexicographic order equals chronological order. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return Math.round((toDbDate(b).getTime() - toDbDate(a).getTime()) / 86_400_000);
}
