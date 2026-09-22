/**
 * Instants — points in time (createdAt, occurredAt, lastLoginAt).
 *
 * Always displayed in the BUSINESS timezone, passed explicitly. Never the
 * server's local timezone: a Vercel function runs in UTC, and "14:05" in an
 * audit log that actually happened at 17:05 in the office is a wrong fact.
 */

import { businessLocale } from '@/brand/brand';

function partsOf(instant: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => formatted.find((part) => part.type === type)?.value ?? '';
  return { day: get('day'), month: get('month'), year: get('year'), hour: get('hour'), minute: get('minute') };
}

/** "16.09.2026 14:05" in the business timezone. */
export function formatDateTime(instant: Date | string, timeZone: string = businessLocale.timeZone): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsOf(date, timeZone);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

/** "16.09.2026" — the calendar day an instant falls on, in the business timezone. */
export function formatInstantDate(instant: Date | string, timeZone: string = businessLocale.timeZone): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsOf(date, timeZone);
  return `${p.day}.${p.month}.${p.year}`;
}
