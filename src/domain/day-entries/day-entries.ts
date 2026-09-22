/**
 * CLOSING THE DAY, AND THE REVEAL — שנינו. BUSINESS_RULES.md §2, §4.
 *
 * R-DAY-05 is this product's one inviolable rule: partner A may read partner
 * B's ratings and note for a date only once A has submitted their own entry
 * for that date. Two people who live together are on opposite sides of this
 * boundary, so it cannot be a UI concern.
 *
 * It is enforced structurally, in the strongest form available: when the day is
 * not revealed, the partner's value columns are **never selected from the
 * database** — not selected and discarded, not nulled in the view. There is no
 * code path in which they exist in memory on an unrevealed request, so no
 * future refactor can accidentally return them.
 *
 * R-ACC-04: no permission opens this. `OWNER` holds `permissions: 'all'` and is
 * refused exactly like `PARTNER`, because the gate is a symmetric state, not a
 * capability. A unit test fails if anyone adds a `day_entries.*_all`
 * permission.
 *
 * R-DAY-30: nothing here writes a rating or a note into the audit log.
 */

import { z } from 'zod';

import { assertCan } from '@/core/access/can';
import { recordAudit } from '@/core/audit/record';
import type { Actor } from '@/core/auth/actor';
import {
  addDays,
  compareCalendarDates,
  fromDbDate,
  toDbDate,
  todayIn,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { localToInstant, type LocalTime } from '@/core/dates/local-time';
import { inTransaction } from '@/core/db/transaction';
import { isUniqueViolation, type DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';
import { getSetting } from '@/core/settings/settings';
import { fields } from '@/core/validation/fields';

import { copy } from '../copy';
import { partnersOf, type PartnerRef } from '../partners';
import { REVIEW_TIME_KEY } from '../settings';

/* ── Request schemas ───────────────────────────────────────────────────── */

const RATING = z.number().int().min(1).max(5);

export const submitDayEntrySchema = z
  .object({
    entryDate: fields.calendarDate(),
    respectRating: RATING,
    note: fields.optionalText({ label: copy.day.noteLabel, max: 1000, multiline: true }),
  })
  .strict();

export const amendDayEntrySchema = z
  .object({
    entryDate: fields.calendarDate(),
    respectRating: RATING,
    note: fields.optionalText({ label: copy.day.noteLabel, max: 1000, multiline: true }),
  })
  .strict();

export type SubmitDayEntryInput = z.infer<typeof submitDayEntrySchema>;
export type AmendDayEntryInput = z.infer<typeof amendDayEntrySchema>;

/* ── Views ─────────────────────────────────────────────────────────────── */

export interface DayEntryValues {
  /** Mutual respect and communication, 1–5. The one daily rating. */
  respectRating: number;
  note: string | null;
  submittedAt: string;
}

export interface DayView {
  date: CalendarDate;
  /** The wall-clock time from which this day may be closed (R-SET-01). */
  reviewTime: LocalTime;
  /** Computed from the same read the service enforces with. */
  canClose: boolean;
  me: PartnerRef;
  /** Null until the second partner exists. */
  partner: PartnerRef | null;

  /** My own entry, always readable in full (R-DAY-04). */
  mine: DayEntryValues | null;
  /** Whether the partner has closed this day. Waiting is not private. */
  partnerSubmitted: boolean;
  /**
   * The partner's values — present ONLY when the day is revealed. Absent, not
   * null: the key does not exist on an unrevealed day, and the columns were
   * never read.
   */
  theirs?: DayEntryValues;
  revealed: boolean;

  permissions: {
    submit: boolean;
    /** R-DAY-03: editable only while the other has not submitted. */
    amend: boolean;
  };
}

/* ── The review window ─────────────────────────────────────────────────── */

/**
 * The instant from which `date` may be closed.
 *
 * `localToInstant` returns null for a wall-clock time inside the spring-forward
 * gap — on that one day of the year the configured time does not exist. Rather
 * than making the day unclosable, the window opens at the next hour, which is
 * the first moment that wall clock is reachable.
 */
function reviewOpensAt(date: CalendarDate, time: LocalTime): Date {
  const exact = localToInstant(date, time);
  if (exact) return exact;

  const [hours = '00', minutes = '00'] = time.split(':');
  const shifted = `${String((Number(hours) + 1) % 24).padStart(2, '0')}:${minutes}` as LocalTime;
  const fallback = localToInstant(date, shifted);
  // Both failing would mean two consecutive non-existent hours, which no
  // timezone has; the start of the next day is still a safe upper bound.
  return fallback ?? localToInstant(addDays(date, 1), '00:00' as LocalTime) ?? new Date(0);
}

/** R-DAY-01. A past day is always closable; today waits for the review time. */
function isClosable(date: CalendarDate, time: LocalTime, now: Date, timeZone?: string): boolean {
  const today = todayIn(timeZone, now);
  if (compareCalendarDates(date, today) < 0) return true;
  if (compareCalendarDates(date, today) > 0) return false;
  return now.getTime() >= reviewOpensAt(date, time).getTime();
}

export async function reviewTimeOf(client: DbClient): Promise<LocalTime> {
  return getSetting(client, REVIEW_TIME_KEY);
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

const VALUE_SELECT = {
  respectRating: true,
  note: true,
  submittedAt: true,
} as const;

function toValues(row: { respectRating: number; note: string | null; submittedAt: Date }): DayEntryValues {
  return {
    respectRating: row.respectRating,
    note: row.note,
    submittedAt: row.submittedAt.toISOString(),
  };
}

/**
 * One day, from this actor's point of view.
 *
 * Three queries rather than one join, deliberately: the third only runs when
 * the day is revealed, so the partner's values are not fetched at all
 * otherwise. On a two-row-per-day table this costs nothing and makes the
 * reveal rule a property of the query plan instead of a property of the
 * mapping code.
 */
export async function getDay(
  client: DbClient,
  actor: Actor,
  date: CalendarDate,
  now: Date = new Date(),
): Promise<DayView> {
  assertCan(actor, 'day_entries.read');

  const [{ me, other }, reviewTime] = await Promise.all([partnersOf(client, actor), reviewTimeOf(client)]);

  const mineRow = await client.dayEntry.findUnique({
    where: { entryDate_partnerId: { entryDate: toDbDate(date), partnerId: actor.id } },
    select: VALUE_SELECT,
  });
  const mine = mineRow ? toValues(mineRow) : null;

  // Existence only. "Has my partner closed the day" is not private — being
  // kept waiting without knowing why would be worse than knowing.
  const partnerStub = other
    ? await client.dayEntry.findUnique({
        where: { entryDate_partnerId: { entryDate: toDbDate(date), partnerId: other.id } },
        select: { id: true },
      })
    : null;
  const partnerSubmitted = partnerStub !== null;

  const revealed = mine !== null && partnerSubmitted;

  const view: DayView = {
    date,
    reviewTime,
    canClose: isClosable(date, reviewTime, now),
    me,
    partner: other,
    mine,
    partnerSubmitted,
    revealed,
    permissions: {
      submit: mine === null && isClosable(date, reviewTime, now),
      // Frozen once seen (R-DAY-03), so the diary cannot be rewritten after
      // the fact.
      amend: mine !== null && !partnerSubmitted,
    },
  };

  if (revealed && other) {
    const theirs = await client.dayEntry.findUnique({
      where: { entryDate_partnerId: { entryDate: toDbDate(date), partnerId: other.id } },
      select: VALUE_SELECT,
    });
    if (theirs) view.theirs = toValues(theirs);
  }

  return view;
}

/**
 * Which dates each partner closed, for the summaries and the streak.
 *
 * Booleans and — only for revealed dates — the four ratings. An unrevealed
 * date contributes the actor's own values and nothing else, which is what
 * R-SUM-02 requires.
 */
export interface RangeDay {
  date: CalendarDate;
  mine: { respectRating: number } | null;
  partnerSubmitted: boolean;
  /** Present only when the date is revealed to this actor. */
  theirs?: { respectRating: number };
}

export async function listRangeDays(
  client: DbClient,
  actor: Actor,
  from: CalendarDate,
  toExclusive: CalendarDate,
): Promise<RangeDay[]> {
  assertCan(actor, 'summaries.read');

  const { other } = await partnersOf(client, actor);
  const window = { gte: toDbDate(from), lt: toDbDate(toExclusive) };

  const mineRows = await client.dayEntry.findMany({
    where: { partnerId: actor.id, entryDate: window },
    select: { entryDate: true, respectRating: true },
  });
  const mineByDate = new Map(mineRows.map((row) => [fromDbDate(row.entryDate), row]));

  // Existence for every date the partner closed; values only where revealed.
  const partnerRows = other
    ? await client.dayEntry.findMany({
        where: { partnerId: other.id, entryDate: window },
        select: { entryDate: true, respectRating: true },
      })
    : [];

  const days: RangeDay[] = [];
  for (let date = from; compareCalendarDates(date, toExclusive) < 0; date = addDays(date, 1)) {
    const mine = mineByDate.get(date) ?? null;
    const partnerRow = partnerRows.find((row) => fromDbDate(row.entryDate) === date) ?? null;

    const day: RangeDay = {
      date,
      mine: mine ? { respectRating: mine.respectRating } : null,
      partnerSubmitted: partnerRow !== null,
    };
    // The same gate as getDay: my entry must exist for theirs to be readable.
    if (mine && partnerRow) {
      day.theirs = { respectRating: partnerRow.respectRating };
    }
    days.push(day);
  }

  return days;
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export async function submitDayEntry(
  client: DbClient,
  actor: Actor,
  input: SubmitDayEntryInput,
  now: Date = new Date(),
): Promise<DayView> {
  assertCan(actor, 'day_entries.submit');

  const date = input.entryDate;
  const note = input.note ?? null;

  return inTransaction(client, async (tx) => {
    const reviewTime = await reviewTimeOf(tx);
    if (!isClosable(date, reviewTime, now)) {
      throw errors.businessRule('REVIEW_NOT_OPEN_YET', copy.errors.reviewNotOpenYet(reviewTime));
    }

    try {
      const created = await tx.dayEntry.create({
        data: {
          entryDate: toDbDate(date),
          // From the session, never from the body.
          partnerId: actor.id,
          respectRating: input.respectRating,
          note,
          submittedAt: now,
        },
        select: { id: true },
      });

      // R-DAY-30 — the date, and nothing else. No rating, no note text.
      await recordAudit(tx, {
        actor,
        action: 'day_entry.submitted',
        entityType: 'day_entry',
        entityId: created.id,
        after: { entryDate: date },
      });
    } catch (error) {
      // R-DAY-02 / R-DAY-10: the unique index is the guarantee, so a race
      // between two taps surfaces as a conflict rather than a second row.
      if (isUniqueViolation(error)) {
        throw errors.conflict(copy.errors.alreadySubmitted, 'DAY_ALREADY_SUBMITTED');
      }
      throw error;
    }

    return getDay(tx, actor, date, now);
  });
}

export async function amendDayEntry(
  client: DbClient,
  actor: Actor,
  input: AmendDayEntryInput,
  now: Date = new Date(),
): Promise<DayView> {
  assertCan(actor, 'day_entries.submit');

  const date = input.entryDate;
  const note = input.note ?? null;

  return inTransaction(client, async (tx) => {
    const { other } = await partnersOf(tx, actor);

    const existing = await tx.dayEntry.findUnique({
      where: { entryDate_partnerId: { entryDate: toDbDate(date), partnerId: actor.id } },
      select: { id: true, respectRating: true, note: true },
    });
    // Only your own entry, and only if it exists (R-DAY-03).
    if (!existing) throw errors.notFound();

    if (other) {
      const partnerEntry = await tx.dayEntry.findUnique({
        where: { entryDate_partnerId: { entryDate: toDbDate(date), partnerId: other.id } },
        select: { id: true },
      });
      if (partnerEntry) {
        throw errors.businessRule('DAY_ALREADY_REVEALED', copy.errors.frozenAfterReveal);
      }
    }

    await tx.dayEntry.update({
      where: { id: existing.id },
      data: {
        respectRating: input.respectRating,
        note,
      },
    });

    // R-DAY-30 — markers, never values.
    await recordAudit(tx, {
      actor,
      action: 'day_entry.amended',
      entityType: 'day_entry',
      entityId: existing.id,
      after: {
        entryDate: date,
        ratingsChanged: existing.respectRating !== input.respectRating,
        noteChanged: (existing.note ?? null) !== note,
      },
    });

    return getDay(tx, actor, date, now);
  });
}

/** Exported for the unit tests of the review window. */
export const reviewWindow = { reviewOpensAt, isClosable };
