import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarDateOfInstant,
  daysBetween,
  formatCalendarDate,
  fromDbDate,
  parseIsoDate,
  parseIsraeliDate,
  toDbDate,
  todayIn,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { formatDateTime } from '@/core/dates/instant';
import { addMonths, formatPeriod, parsePeriodKey, periodBounds, periodKey } from '@/core/dates/period';

describe('parseIsraeliDate — strict, day first', () => {
  it('reads DD.MM.YYYY with . / - separators', () => {
    expect(parseIsraeliDate('01.10.2026')).toBe('2026-10-01');
    expect(parseIsraeliDate('1/10/2026')).toBe('2026-10-01');
    expect(parseIsraeliDate('03-04-2026')).toBe('2026-04-03'); // 3 April, never 4 March
  });

  it('rejects dates JavaScript would silently roll over', () => {
    expect(parseIsraeliDate('31.04.2026')).toBeNull();
    expect(parseIsraeliDate('30.02.2026')).toBeNull();
    expect(parseIsraeliDate('29.02.2026')).toBeNull();
    expect(parseIsraeliDate('00.01.2026')).toBeNull();
    expect(parseIsraeliDate('01.13.2026')).toBeNull();
  });

  it('accepts real leap days', () => {
    expect(parseIsraeliDate('29.02.2028')).toBe('2028-02-29');
  });

  it('rejects ambiguous or malformed input', () => {
    for (const input of ['01.10.26', '2026-10-01', '01.10/2026', '1.1', '', 'אתמול', '01.10.2026 10:00']) {
      expect(parseIsraeliDate(input)).toBeNull();
    }
  });

  it('ignores invisible bidi marks from pasting', () => {
    expect(parseIsraeliDate(`${String.fromCharCode(0x200f)}01.10.2026`)).toBe('2026-10-01');
  });
});

describe('ISO dates and the database', () => {
  it('validates ISO strictly', () => {
    expect(parseIsoDate('2026-04-31')).toBeNull();
    expect(parseIsoDate('2026-4-1')).toBeNull();
    expect(parseIsoDate('2026-04-30')).toBe('2026-04-30');
  });

  it('round-trips through the DATE column representation in any timezone', () => {
    const date = '2026-10-01' as CalendarDate;
    expect(fromDbDate(toDbDate(date))).toBe(date);
    expect(toDbDate(date).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('formats as DD.MM.YYYY, zero-padded', () => {
    expect(formatCalendarDate('2026-01-05' as CalendarDate)).toBe('05.01.2026');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31' as CalendarDate, 1)).toBe('2027-01-01');
    expect(daysBetween('2026-02-27' as CalendarDate, '2026-03-01' as CalendarDate)).toBe(2);
  });
});

describe('business timezone', () => {
  it('"today" is the Israeli calendar day, not the server UTC day', () => {
    // 22:30 UTC on 15 Sept is 01:30 on 16 Sept in Israel (IDT, UTC+3).
    const instant = new Date('2026-09-15T22:30:00Z');
    expect(todayIn('Asia/Jerusalem', instant)).toBe('2026-09-16');
    expect(calendarDateOfInstant(instant, 'UTC')).toBe('2026-09-15');
  });

  it('formats instants in the business timezone', () => {
    expect(formatDateTime('2026-09-15T22:30:00Z')).toBe('16.09.2026 01:30');
    expect(formatDateTime('2026-01-15T10:00:00Z')).toBe('15.01.2026 12:00'); // winter, UTC+2
  });
});

describe('periods', () => {
  it('moves across years in both directions', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 3 }, -15)).toEqual({ year: 2024, month: 12 });
  });

  it('parses keys strictly and gives half-open bounds', () => {
    expect(parsePeriodKey('2026-08')).toEqual({ year: 2026, month: 8 });
    expect(parsePeriodKey('2026-13')).toBeNull();
    expect(parsePeriodKey('2026-8')).toBeNull();
    expect(periodKey({ year: 2026, month: 8 })).toBe('2026-08');
    expect(periodBounds({ year: 2026, month: 12 })).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
    expect(formatPeriod({ year: 2026, month: 8 })).toBe('אוגוסט 2026');
  });
});
