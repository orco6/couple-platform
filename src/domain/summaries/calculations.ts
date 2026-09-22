/**
 * SUMMARY CALCULATIONS — שנינו. BUSINESS_RULES.md §5.
 *
 * Pure functions over plain shapes: no database, no Prisma types, no actor.
 * Every worked example in §5 is a test case in
 * tests/unit/summaries/calculations.test.ts, copied verbatim.
 *
 * ROUNDING. Displayed averages are one decimal, half away from zero, rounded
 * once at the end. The arithmetic multiplies by ten *before* dividing
 * (`round(sum * 10 / count)`) so the value being rounded is as well
 * conditioned as the inputs allow: 13/4 reaches the rounder as exactly 32.5,
 * not as 3.2499999999999996. Ratings are 1–5 and counts are positive, so
 * `Math.round`'s behaviour on negative halves never arises.
 */

export interface Rating {
  executionRating: number;
  respectRating: number;
}

/** A day as one partner can see it. `theirs` exists only on a revealed day. */
export interface RangeDayInput {
  date: string;
  mine: Rating | null;
  partnerSubmitted: boolean;
  theirs?: Rating;
}

/** One decimal, half away from zero, from an exact integer sum and count. */
function averageOf(sum: number, count: number): number | null {
  if (count === 0) return null;
  return Math.round((sum * 10) / count) / 10;
}

/** R-CALC-01 — a partner's average for one day. */
export function dayAverage(rating: Rating): number {
  return averageOf(rating.executionRating + rating.respectRating, 2) as number;
}

/**
 * R-CALC-02 — one partner's average over the range.
 *
 * Every entry contributes both of its ratings, so a day counts twice as much
 * as a single rating would — which is right: the day is the unit, and the day
 * has two questions. Null for "no entries", never 0: no data is not a bad day.
 */
export function partnerRangeAverage(ratings: readonly Rating[]): number | null {
  let sum = 0;
  for (const rating of ratings) sum += rating.executionRating + rating.respectRating;
  return averageOf(sum, ratings.length * 2);
}

/**
 * R-CALC-03 — the couple's average over the range.
 *
 * Only dates BOTH partners closed count. A day only one of them closed is not
 * a data point about the couple, and including it would let one partner's mood
 * move a figure they both read as shared. It still counts in that partner's own
 * average (R-CALC-02) — two questions, two denominators, and the summary
 * labels say which is which.
 */
export function coupleRangeAverage(days: readonly RangeDayInput[]): number | null {
  let sum = 0;
  let count = 0;
  for (const day of days) {
    if (!day.mine || !day.theirs) continue;
    sum += day.mine.executionRating + day.mine.respectRating;
    sum += day.theirs.executionRating + day.theirs.respectRating;
    count += 4;
  }
  return averageOf(sum, count);
}

/**
 * R-CALC-04 — consecutive days both partners closed, counting back.
 *
 * Today is skipped once if it is not closed yet: a day still in progress is
 * not a broken streak, and showing "0" at 18:00 every day would make the
 * number feel punitive. Any earlier gap does stop the count.
 */
export function closedTogetherStreak(days: readonly RangeDayInput[], today: string): number {
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (!day) break;
    const bothClosed = day.mine !== null && day.partnerSubmitted;

    if (!bothClosed) {
      // The one allowance: the live day, and only at the very end of the range.
      if (day.date === today && index === days.length - 1) continue;
      break;
    }
    streak += 1;
  }
  return streak;
}

export interface TaskCompletion {
  /** Null when the range holds no tasks at all — not 0%. */
  percent: number | null;
  done: number;
  total: number;
  /** Absent when nothing was completed, so there is nothing to split. */
  split?: { mine: number; theirs: number };
}

/**
 * R-CALC-05 — how the shared list went.
 *
 * The two split percentages are computed as `x` and `100 - x` so the pair
 * always reads as a whole; rounding each independently produces "67% / 34%",
 * which looks like a bug to anyone who adds them up.
 */
export function taskCompletion(
  tasks: readonly { completedById: string | null }[],
  myId: string,
): TaskCompletion {
  const total = tasks.length;
  if (total === 0) return { percent: null, done: 0, total: 0 };

  const completed = tasks.filter((task) => task.completedById !== null);
  const done = completed.length;
  const percent = Math.round((done * 100) / total);
  if (done === 0) return { percent, done, total };

  const mine = Math.round((completed.filter((task) => task.completedById === myId).length * 100) / done);
  return { percent, done, total, split: { mine, theirs: 100 - mine } };
}

/**
 * R-CALC-06 — the best day of the range (monthly summary).
 *
 * Revealed days only, by the mean of all four ratings. Ties resolve to the
 * LATER date: the more recent good day is the one worth being reminded of.
 */
export function bestDay(days: readonly RangeDayInput[]): { date: string; average: number } | null {
  let best: { date: string; average: number } | null = null;

  for (const day of days) {
    if (!day.mine || !day.theirs) continue;
    const average = averageOf(
      day.mine.executionRating + day.mine.respectRating + day.theirs.executionRating + day.theirs.respectRating,
      4,
    ) as number;
    // `>=` is what makes a tie resolve to the later date, since days are in
    // ascending order.
    if (!best || average >= best.average) best = { date: day.date, average };
  }

  return best;
}

/** How many days in the range both partners closed. */
export function daysClosedTogether(days: readonly RangeDayInput[]): number {
  return days.filter((day) => day.mine !== null && day.partnerSubmitted).length;
}
