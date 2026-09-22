/**
 * R-DAY-05 — THE REVEAL RULE.
 *
 * Partner A may read partner B's rating and note for a date only once A has
 * submitted their own entry for that date. Two people who live together are on
 * opposite sides of this boundary, so it is tested the way a boundary is:
 * from the wrong side, by the most privileged account, and by checking that
 * the value is *absent* rather than nulled.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { addDays, type CalendarDate } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import {
  amendDayEntry,
  getDay,
  listRangeDays,
  submitDayEntry,
} from '@/domain/day-entries/day-entries';

import { caught } from '../../support/factories';
import { makeCouple, type Couple } from './factories';

let couple: Couple;
/** Yesterday: always past the review time, so the window never flakes. */
let date: CalendarDate;

beforeEach(async () => {
  couple = await makeCouple();
  date = addDays(couple.today, -1);
});

describe('R-DAY-05 the partner’s values are withheld until I submit', () => {
  it('before I submit, their values are ABSENT from the view — not null', async () => {
    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 5, note: 'פתק פרטי' });

    const view = await getDay(db, couple.owner, date);

    expect(view.partnerSubmitted).toBe(true);
    expect(view.revealed).toBe(false);
    // Absent, not null: a null would still be a shape the UI could render and
    // a future refactor could fill in.
    expect('theirs' in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('פתק פרטי');
  });

  it('the OWNER, holding every permission, is refused exactly like anyone else', async () => {
    // R-ACC-04. The gate is a symmetric state, not a capability, so
    // permissions: 'all' must not open it.
    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 2, note: 'סוד' });

    const view = await getDay(db, couple.owner, date);

    expect('theirs' in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('סוד');
  });

  it('once both have submitted, both sides read the pair', async () => {
    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 5, note: 'שלהם' });
    await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 4, note: 'שלי' });

    const asOwner = await getDay(db, couple.owner, date);
    const asPartner = await getDay(db, couple.partner, date);

    expect(asOwner.revealed).toBe(true);
    expect(asOwner.theirs?.respectRating).toBe(5);
    expect(asOwner.mine?.respectRating).toBe(4);
    expect(asPartner.theirs?.respectRating).toBe(4);
    expect(asPartner.mine?.respectRating).toBe(5);
  });

  it('waiting is visible — being kept waiting without knowing why is worse', async () => {
    const before = await getDay(db, couple.owner, date);
    expect(before.partnerSubmitted).toBe(false);

    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 3 });

    const after = await getDay(db, couple.owner, date);
    expect(after.partnerSubmitted).toBe(true);
    expect(after.revealed).toBe(false);
  });
});

describe('R-SUM-02 a range never leaks an unrevealed rating', () => {
  it('listRangeDays withholds their values on days I have not closed', async () => {
    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 5 });

    const days = await listRangeDays(db, couple.owner, date, addDays(date, 1));

    expect(days).toHaveLength(1);
    expect(days[0]?.partnerSubmitted).toBe(true);
    expect(days[0]?.theirs).toBeUndefined();
  });

  it('and includes them once the day is revealed', async () => {
    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 5 });
    await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 3 });

    const days = await listRangeDays(db, couple.owner, date, addDays(date, 1));

    expect(days[0]?.theirs?.respectRating).toBe(5);
    expect(days[0]?.mine?.respectRating).toBe(3);
  });
});

describe('R-DAY-02 / R-DAY-03 one entry per day, frozen once seen', () => {
  it('submitting twice for the same day is a conflict, not a second row', async () => {
    await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 4 });

    const error = await caught(() => submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 5 }));

    expect(error.code).toBe('DAY_ALREADY_SUBMITTED');
    expect(error.category).toBe('conflict');
    expect(await db.dayEntry.count({ where: { entryDate: new Date(date), partnerId: couple.owner.id } })).toBe(1);
  });

  it('I may change mine while they have not closed theirs', async () => {
    await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 2, note: 'ראשון' });

    const view = await amendDayEntry(db, couple.owner, { entryDate: date, respectRating: 4, note: 'מתוקן' });

    expect(view.mine?.respectRating).toBe(4);
    expect(view.mine?.note).toBe('מתוקן');
  });

  it('once the day is revealed it is frozen — the diary cannot be rewritten', async () => {
    await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 2 });
    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 5 });

    const error = await caught(() => amendDayEntry(db, couple.owner, { entryDate: date, respectRating: 5 }));

    expect(error.code).toBe('DAY_ALREADY_REVEALED');
    const row = await db.dayEntry.findFirst({ where: { partnerId: couple.owner.id } });
    expect(row?.respectRating).toBe(2);
  });

  it('I cannot amend an entry I never wrote', async () => {
    await submitDayEntry(db, couple.partner, { entryDate: date, respectRating: 5 });

    const error = await caught(() => amendDayEntry(db, couple.owner, { entryDate: date, respectRating: 1 }));

    expect(error.category).toBe('not_found');
    const row = await db.dayEntry.findFirst({ where: { partnerId: couple.partner.id } });
    expect(row?.respectRating).toBe(5);
  });
});

describe('R-DAY-01 the day cannot be closed before the review time', () => {
  it('today is refused before the configured time, naming when it opens', async () => {
    // 23:59 has not arrived for any test run, and the default is 21:30, so
    // pinning the setting keeps this independent of the clock.
    await db.setting.create({ data: { key: 'review.daily_time', value: '23:59' } });

    const error = await caught(() =>
      submitDayEntry(db, couple.owner, { entryDate: couple.today, respectRating: 4 }, new Date('2026-09-22T08:00:00Z')),
    );

    expect(error.code).toBe('REVIEW_NOT_OPEN_YET');
    expect(error.message).toContain('23:59');
  });

  it('a past day is always closable, whatever the time is now', async () => {
    await db.setting.create({ data: { key: 'review.daily_time', value: '23:59' } });

    const view = await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 4 });

    expect(view.mine?.respectRating).toBe(4);
  });
});

describe('R-DAY-30 ratings and notes never enter the audit log', () => {
  it('a submission records the date and nothing else', async () => {
    await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 1, note: 'טקסט פרטי מאוד' });

    const events = await db.auditEvent.findMany({ where: { entityType: 'day_entry' } });

    expect(events).toHaveLength(1);
    const payload = JSON.stringify(events[0]?.after);
    expect(payload).toContain(date);
    expect(payload).not.toContain('טקסט פרטי מאוד');
    expect(payload).not.toContain('respectRating');
  });

  it('an amendment records markers, never values', async () => {
    await submitDayEntry(db, couple.owner, { entryDate: date, respectRating: 1, note: 'ראשון' });
    await amendDayEntry(db, couple.owner, { entryDate: date, respectRating: 5, note: 'שני' });

    const event = await db.auditEvent.findFirst({ where: { action: 'day_entry.amended' } });
    const payload = JSON.stringify(event?.after);

    expect(payload).toContain('ratingsChanged');
    expect(payload).toContain('noteChanged');
    expect(payload).not.toContain('ראשון');
    expect(payload).not.toContain('שני');
  });
});
