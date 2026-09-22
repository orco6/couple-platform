/**
 * Local wall-clock times in the business timezone ("16.09.2026 at 10:30").
 *
 * For appointments, shifts, deliveries: a person means a time on the office
 * clock, but the database must store an instant. Converting between the two is
 * where daylight-saving bugs live, so it happens here, once, without guessing:
 *
 *   • Times that do not exist (the spring-forward gap, e.g. 02:30 on the night
 *     Israel moves to summer time) are REJECTED — never silently shifted.
 *   • Times that exist twice (the autumn fall-back hour) resolve to the EARLIER
 *     instant, and `isAmbiguousLocalTime` lets a form warn about it.
 *
 * Stored as a DateTime (timestamptz). Displayed with formatDateTime (instant.ts).
 */

import { businessLocale } from '@/brand/brand';
import { parseIsoDate, type CalendarDate } from './calendar-date';

declare const localTimeBrand: unique symbol;
/** "HH:MM", 24-hour. */
export type LocalTime = string & { readonly [localTimeBrand]: true };

/** Strict: "9:05" and "09:05" accepted; "24:00", "9:5", "9.05", "9:05 PM" rejected. */
export function parseLocalTime(input: string): LocalTime | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` as LocalTime;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function wallClockOf(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** Offset of the zone from UTC at an instant, in minutes (Israel: +120 or +180). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const wall = wallClockOf(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return Math.round((asUtc - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

function candidates(date: CalendarDate, time: LocalTime, timeZone: string): Date[] {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);

  // The true offset is one of the offsets in force a few hours either side.
  const offsets = new Set(
    [-12, 0, 12].map((hours) => offsetMinutes(new Date(localAsUtc + hours * 3_600_000), timeZone)),
  );

  const matches: Date[] = [];
  for (const offset of offsets) {
    const instant = new Date(localAsUtc - offset * 60_000);
    const wall = wallClockOf(instant, timeZone);
    if (wall.year === year && wall.month === month && wall.day === day && wall.hour === hour && wall.minute === minute) {
      matches.push(instant);
    }
  }
  return matches.sort((a, b) => a.getTime() - b.getTime());
}

/** The instant for a local date + time, or null if that local time does not exist (DST gap). */
export function localToInstant(
  date: CalendarDate,
  time: LocalTime,
  timeZone: string = businessLocale.timeZone,
): Date | null {
  if (!parseIsoDate(date) || !parseLocalTime(time)) return null;
  return candidates(date, time, timeZone)[0] ?? null;
}

/** True when the local time occurs twice (DST fall-back hour). */
export function isAmbiguousLocalTime(date: CalendarDate, time: LocalTime, timeZone: string = businessLocale.timeZone): boolean {
  return candidates(date, time, timeZone).length > 1;
}

/** The business-clock date and time of an instant. */
export function instantToLocal(instant: Date, timeZone: string = businessLocale.timeZone): { date: CalendarDate; time: LocalTime } {
  const wall = wallClockOf(instant, timeZone);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}` as CalendarDate,
    time: `${pad(wall.hour)}:${pad(wall.minute)}` as LocalTime,
  };
}

/**
 * The instants bounding one business calendar day: [start, endExclusive).
 * For "today's appointments" queries: `startsAt: { gte: start, lt: endExclusive }`.
 * DST days are 23 or 25 hours long; this returns the real length.
 */
export function localDayRange(date: CalendarDate, timeZone: string = businessLocale.timeZone): { start: Date; endExclusive: Date } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}` as CalendarDate;
  const midnight = '00:00' as LocalTime;
  const start = localToInstant(date, midnight, timeZone);
  const endExclusive = localToInstant(nextDate, midnight, timeZone);
  // Midnight exists in every zone this foundation targets; fail loudly rather than guess if one does not.
  if (!start || !endExclusive) throw new RangeError(`Local midnight does not exist on ${date} in ${timeZone}`);
  return { start, endExclusive };
}
