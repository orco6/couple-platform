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
 *
 * THIS IS NOT ANALYTICS. Every figure here answers a question a couple would
 * actually ask out loud — "did we get through the list", "how did the things I
 * asked for go", "how were we with each other". Anything that needed a legend
 * to understand was left out on purpose.
 */

/** A day as one partner can see it. `theirs` exists only on a revealed day. */
export interface RangeDayInput {
  date: string;
  mine: { respectRating: number } | null;
  partnerSubmitted: boolean;
  theirs?: { respectRating: number };
}

export interface TaskInput {
  /** ISO business date. Typed as a plain string so this module stays free of
   *  core's branded types — a `CalendarDate` is assignable to it. */
  taskDate: string;
  title: string;
  completedById: string | null;
  ownerId: string;
  /** The other partner's 1–5, or null while it is still waiting. */
  ratingValue: number | null;
}

/** One decimal, half away from zero, from an exact integer sum and count. */
function averageOf(sum: number, count: number): number | null {
  if (count === 0) return null;
  return Math.round((sum * 10) / count) / 10;
}

/* ── The list ──────────────────────────────────────────────────────────── */

export interface Completion {
  /** Null when the range holds no tasks at all — not 0%. */
  percent: number | null;
  done: number;
  total: number;
  /** Share of the range's tasks each partner was responsible for. */
  ownerShare?: { mine: number; theirs: number };
}

/**
 * R-CALC-01 — how the list went.
 *
 * The owner split is about *responsibility*, not who ticked the box: either
 * partner can complete anything, so counting completions would measure who
 * happened to be holding the phone. The two percentages are computed as `x`
 * and `100 - x` so the pair always reads as a whole; rounding each
 * independently produces "67% / 34%", which looks like a bug to anyone who
 * adds them up.
 */
export function completion(tasks: readonly TaskInput[], myId: string): Completion {
  const total = tasks.length;
  if (total === 0) return { percent: null, done: 0, total: 0 };

  const done = tasks.filter((task) => task.completedById !== null).length;
  const percent = Math.round((done * 100) / total);

  const mine = Math.round((tasks.filter((task) => task.ownerId === myId).length * 100) / total);
  return { percent, done, total, ownerShare: { mine, theirs: 100 - mine } };
}

/** Done and total, for one slice of the list. */
export interface Tally {
  done: number;
  total: number;
}

/**
 * How the list went, day by day — one entry per date asked for, in order, so
 * a day with no tasks is an honest 0 of 0 rather than a missing bar.
 */
export function completionByDay(tasks: readonly TaskInput[], dates: readonly string[]): (Tally & { date: string })[] {
  return dates.map((date) => {
    const those = tasks.filter((task) => task.taskDate === date);
    return { date, done: those.filter((task) => task.completedById !== null).length, total: those.length };
  });
}

/**
 * How the list went for each person — by who the task belonged to, not who
 * ticked it (either may complete the other's task; the owner is who it was on).
 */
export function completionByOwner(tasks: readonly TaskInput[], ownerIds: readonly string[]): (Tally & { ownerId: string })[] {
  return ownerIds.map((ownerId) => {
    const those = tasks.filter((task) => task.ownerId === ownerId);
    return { ownerId, done: those.filter((task) => task.completedById !== null).length, total: those.length };
  });
}

/**
 * R-CALC-02 — the average task-execution rating.
 *
 * Only rated tasks count. An unrated task is not a zero: it means the other
 * partner has not said anything yet, and treating silence as a bad score would
 * make the figure punish the rater's forgetfulness.
 *
 * And only tasks that are *currently* finished. A rating outlives its task
 * being reopened, because nothing here is ever deleted (R-RATE-03) — so
 * "rated" alone would let a task that went back on the list keep feeding a
 * figure about work that got done. The week would then read "half the list
 * closed, execution 4.0", where the 4.0 described something the same screen
 * says is not closed.
 */
export function executionAverage(tasks: readonly TaskInput[]): number | null {
  const rated = tasks.filter((task) => task.completedById !== null && task.ratingValue !== null);
  let sum = 0;
  for (const task of rated) sum += task.ratingValue as number;
  return averageOf(sum, rated.length);
}

/** Completed tasks still waiting for the other partner's rating. */
export function unratedCompletedCount(tasks: readonly TaskInput[]): number {
  return tasks.filter((task) => task.completedById !== null && task.ratingValue === null).length;
}

/* ── The relationship ─────────────────────────────────────────────────── */

/**
 * R-CALC-03 — the couple's mutual-respect average.
 *
 * Only days BOTH partners closed count. A day only one of them closed is not a
 * data point about the couple, and including it would let one partner's mood
 * move a figure they both read as shared. It still counts in that partner's own
 * average (`myRespectAverage`) — two questions, two denominators, and the
 * labels say which is which.
 */
export function coupleRespectAverage(days: readonly RangeDayInput[]): number | null {
  let sum = 0;
  let count = 0;
  for (const day of days) {
    if (!day.mine || !day.theirs) continue;
    sum += day.mine.respectRating + day.theirs.respectRating;
    count += 2;
  }
  return averageOf(sum, count);
}

export function myRespectAverage(days: readonly RangeDayInput[]): number | null {
  const mine = days.flatMap((day) => (day.mine ? [day.mine.respectRating] : []));
  let sum = 0;
  for (const value of mine) sum += value;
  return averageOf(sum, mine.length);
}

/**
 * R-CALC-04 — consecutive days both partners closed, counting back.
 *
 * Two kinds of day are skipped rather than counted as gaps:
 *
 *   • days that have not happened yet. The current week's range runs to
 *     Saturday, so on a Tuesday it contains four future days; counting them as
 *     gaps made a couple who had closed every day so far see "0".
 *   • today, if it is not closed yet. A day still in progress is not a broken
 *     streak, and showing "0" at 18:00 every day would make the number feel
 *     punitive.
 *
 * Any gap before that does stop the count.
 */
export function closedTogetherStreak(days: readonly RangeDayInput[], today: string): number {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (!day) break;

    // ISO dates compare correctly as strings.
    if (day.date > today) continue;

    const bothClosed = day.mine !== null && day.partnerSubmitted;
    if (!bothClosed) {
      if (day.date === today) continue;
      break;
    }
    streak += 1;
  }

  return streak;
}

export function daysClosedTogether(days: readonly RangeDayInput[]): number {
  return days.filter((day) => day.mine !== null && day.partnerSubmitted).length;
}

/**
 * R-CALC-05 — the range's best day, by the couple's respect rating.
 *
 * Revealed days only. Ties resolve to the LATER date: the more recent good day
 * is the one worth being reminded of.
 */
export function bestDay(days: readonly RangeDayInput[]): { date: string; average: number } | null {
  let best: { date: string; average: number } | null = null;
  for (const day of days) {
    if (!day.mine || !day.theirs) continue;
    const average = averageOf(day.mine.respectRating + day.theirs.respectRating, 2) as number;
    if (!best || average >= best.average) best = { date: day.date, average };
  }
  return best;
}

/**
 * R-CALC-06 — did the respect rating fall across the range?
 *
 * Compares the first half of the closed days with the last half. Only reported
 * when there are at least four closed days and the drop is a whole point or
 * more: below that it is noise, and a product that tells two people their
 * relationship is declining had better be sure.
 */
export function respectDipped(days: readonly RangeDayInput[]): boolean {
  const closed = days.filter((day) => day.mine !== null && day.theirs);
  if (closed.length < 4) return false;

  const middle = Math.floor(closed.length / 2);
  const first = coupleRespectAverage(closed.slice(0, middle));
  const last = coupleRespectAverage(closed.slice(middle));
  if (first === null || last === null) return false;

  return first - last >= 1;
}

/* ── Trend, for the month ─────────────────────────────────────────────── */

export type TrendDirection = 'up' | 'down' | 'flat';

/**
 * The shape of a run of weekly figures, for the monthly view. Compares the last
 * value with the first; a change smaller than `threshold` is flat, because a
 * trend arrow that flickers on 0.1 is worse than no arrow.
 */
export function trend(values: readonly (number | null)[], threshold = 0.3): TrendDirection {
  const present = values.filter((value): value is number => value !== null);
  if (present.length < 2) return 'flat';
  const delta = (present.at(-1) as number) - (present[0] as number);
  if (Math.abs(delta) < threshold) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

/* ── The one gentle insight ───────────────────────────────────────────── */

export type InsightKey =
  | 'unratedTasks'
  | 'lowCompletion'
  | 'unbalancedTasks'
  | 'fewClosedDays'
  | 'respectDip'
  | 'allGood';

export interface Insight {
  key: InsightKey;
  /** Extra the copy needs: a count, or whose share was too big. */
  count?: number;
  heavierOwnerIsMe?: boolean;
}

/**
 * R-CALC-07 — ONE improvement, chosen by what is most actionable.
 *
 * Deliberately one. A list of five things to do better is a performance
 * review, and nobody opens a couple app to get one. The order below is the
 * order of "cheapest thing that would most change next week":
 *
 *   1. unrated tasks — a five-second fix, and it is the feedback the other
 *      person is actually waiting for;
 *   2. low completion — the list is too long, not the people;
 *   3. unbalanced ownership — a conversation worth having;
 *   4. few closed days — the ritual itself is what makes the rest work;
 *   5. a real dip in respect — last, because it is the heaviest thing to say
 *      and the others are more likely to be the cause;
 *   6. nothing — say so, and say nothing else.
 */
export function weeklyInsight(input: {
  tasks: readonly TaskInput[];
  days: readonly RangeDayInput[];
  completion: Completion;
  myId: string;
}): Insight {
  const unrated = unratedCompletedCount(input.tasks);
  if (unrated > 0) return { key: 'unratedTasks', count: unrated };

  if (input.completion.percent !== null && input.completion.total >= 4 && input.completion.percent < 50) {
    return { key: 'lowCompletion' };
  }

  const share = input.completion.ownerShare;
  if (share && input.completion.total >= 4 && (share.mine >= 75 || share.theirs >= 75)) {
    return { key: 'unbalancedTasks', heavierOwnerIsMe: share.mine >= 75 };
  }

  if (daysClosedTogether(input.days) < 3) return { key: 'fewClosedDays' };

  if (respectDipped(input.days)) return { key: 'respectDip' };

  return { key: 'allGood' };
}
