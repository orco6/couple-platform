import { describe, expect, it } from 'vitest';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { instantToLocal, isAmbiguousLocalTime, localDayRange, localToInstant, parseLocalTime, type LocalTime } from '@/core/dates/local-time';
import { fields } from '@/core/validation/fields';

const d = (value: string) => value as CalendarDate;
const t = (value: string) => value as LocalTime;

describe('parseLocalTime', () => {
  it('accepts 24-hour HH:MM', () => {
    expect(parseLocalTime('9:05')).toBe('09:05');
    expect(parseLocalTime('23:59')).toBe('23:59');
    expect(parseLocalTime('00:00')).toBe('00:00');
  });

  it.each(['24:00', '12:60', '9:5', '9.05', '9:05 PM', '', '0905'])('rejects %j', (input) => {
    expect(parseLocalTime(input)).toBeNull();
  });
});

describe('local business time ↔ instant (Asia/Jerusalem)', () => {
  it('converts in winter (UTC+2) and summer (UTC+3)', () => {
    expect(localToInstant(d('2026-01-15'), t('10:30'))?.toISOString()).toBe('2026-01-15T08:30:00.000Z');
    expect(localToInstant(d('2026-07-15'), t('10:30'))?.toISOString()).toBe('2026-07-15T07:30:00.000Z');
  });

  it('rejects a time that does not exist on the spring-forward night (27.03.2026 02:00→03:00)', () => {
    expect(localToInstant(d('2026-03-27'), t('02:30'))).toBeNull();
    expect(localToInstant(d('2026-03-27'), t('03:00'))?.toISOString()).toBe('2026-03-27T00:00:00.000Z');
    expect(localToInstant(d('2026-03-27'), t('01:59'))?.toISOString()).toBe('2026-03-26T23:59:00.000Z');
  });

  it('resolves the repeated autumn hour (25.10.2026 01:00–02:00) to the earlier instant and reports it', () => {
    expect(isAmbiguousLocalTime(d('2026-10-25'), t('01:30'))).toBe(true);
    expect(localToInstant(d('2026-10-25'), t('01:30'))?.toISOString()).toBe('2026-10-24T22:30:00.000Z');
    expect(isAmbiguousLocalTime(d('2026-10-25'), t('03:30'))).toBe(false);
  });

  it('round-trips through the business clock, independent of the server timezone', () => {
    for (const [date, time] of [['2026-03-27', '03:15'], ['2026-10-25', '00:45'], ['2026-12-31', '23:59'], ['2026-06-01', '00:00']] as const) {
      const instant = localToInstant(d(date), t(time))!;
      expect(instantToLocal(instant)).toEqual({ date, time });
    }
  });

  it('works for other zones too', () => {
    expect(localToInstant(d('2026-07-01'), t('09:00'), 'Europe/London')?.toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });
});

describe('fields.localTime', () => {
  it('validates request input strictly', () => {
    expect(fields.localTime().safeParse('07:30').data).toBe('07:30');
    expect(fields.localTime().safeParse('23:59').success).toBe(true);
    for (const bad of ['7:30', '24:00', '09:60', '0930', ' 09:30', '09:30:00', '', 930]) {
      expect(fields.localTime().safeParse(bad).success).toBe(false);
    }
  });
});

describe('localDayRange', () => {
  it('spans exactly one business day, including 23- and 25-hour DST days', () => {
    const normal = localDayRange(d('2026-09-16'));
    expect(normal.start.toISOString()).toBe('2026-09-15T21:00:00.000Z');
    expect(normal.endExclusive.getTime() - normal.start.getTime()).toBe(24 * 3_600_000);

    const spring = localDayRange(d('2026-03-27'));
    expect(spring.endExclusive.getTime() - spring.start.getTime()).toBe(23 * 3_600_000);

    const autumn = localDayRange(d('2026-10-25'));
    expect(autumn.endExclusive.getTime() - autumn.start.getTime()).toBe(25 * 3_600_000);
  });

  it('an appointment at 23:30 Israel time belongs to that day, not the next UTC day', () => {
    const range = localDayRange(d('2026-07-15'));
    const lateAppointment = localToInstant(d('2026-07-15'), t('23:30'))!;
    expect(lateAppointment >= range.start && lateAppointment < range.endExclusive).toBe(true);
    expect(lateAppointment.toISOString().slice(0, 10)).toBe('2026-07-15');
    const earlyNextDay = localToInstant(d('2026-07-16'), t('00:30'))!;
    expect(earlyNextDay.toISOString().slice(0, 10)).toBe('2026-07-15'); // UTC date differs — the reason this helper exists
    expect(earlyNextDay < range.endExclusive).toBe(false);
  });
});
