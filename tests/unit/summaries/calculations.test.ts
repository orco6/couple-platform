/**
 * The worked examples from BUSINESS_RULES.md §5, copied verbatim.
 *
 * If a figure on a summary screen is ever questioned, this file is the answer:
 * the rule ID, the inputs, and the number the business agreed to.
 */

import { describe, expect, it } from 'vitest';

import {
  bestDay,
  closedTogetherStreak,
  coupleRangeAverage,
  dayAverage,
  daysClosedTogether,
  partnerRangeAverage,
  taskCompletion,
  type RangeDayInput,
} from '@/domain/summaries/calculations';
import { monthBounds, shiftAnchor, weekBounds } from '@/domain/summaries/summaries';
import type { CalendarDate } from '@/core/dates/calendar-date';

const d = (value: string) => value as CalendarDate;

describe('R-CALC-01 day average for a partner', () => {
  it.each([
    { execution: 4, respect: 3, expected: 3.5 },
    { execution: 5, respect: 5, expected: 5 },
    { execution: 5, respect: 4, expected: 4.5 },
    { execution: 1, respect: 1, expected: 1 },
  ])('($execution, $respect) → $expected', ({ execution, respect, expected }) => {
    expect(dayAverage({ executionRating: execution, respectRating: respect })).toBe(expected);
  });
});

describe('R-CALC-02 range average for one partner', () => {
  it('three days (4,3), (5,5), (2,2) → 21/6 = 3.5', () => {
    expect(
      partnerRangeAverage([
        { executionRating: 4, respectRating: 3 },
        { executionRating: 5, respectRating: 5 },
        { executionRating: 2, respectRating: 2 },
      ]),
    ).toBe(3.5);
  });

  it('one day (3,4) → 3.5', () => {
    expect(partnerRangeAverage([{ executionRating: 3, respectRating: 4 }])).toBe(3.5);
  });

  it('no entries → null, not 0 (no data is not a bad day)', () => {
    expect(partnerRangeAverage([])).toBeNull();
  });
});

describe('R-CALC-03 range average for the couple', () => {
  // Mon both, Tue only me. The couple average uses Monday's four ratings.
  const days: RangeDayInput[] = [
    {
      date: '2026-09-21',
      mine: { executionRating: 4, respectRating: 3 },
      partnerSubmitted: true,
      theirs: { executionRating: 3, respectRating: 3 },
    },
    { date: '2026-09-22', mine: { executionRating: 5, respectRating: 5 }, partnerSubmitted: false },
  ];

  it('one mutual day, one single → mean of 4,3,3,3 = 3.25 → 3.3', () => {
    expect(coupleRangeAverage(days)).toBe(3.3);
  });

  it('and my own average on the same data is a different question → 4.3', () => {
    // The contrast the summary labels have to make clear: same data, two
    // denominators. 4,3,5,5 = 4.25 → 4.3.
    const mine = days.flatMap((day) => (day.mine ? [day.mine] : []));
    expect(partnerRangeAverage(mine)).toBe(4.3);
  });

  it('nothing mutual → null', () => {
    expect(
      coupleRangeAverage([{ date: '2026-09-22', mine: { executionRating: 4, respectRating: 4 }, partnerSubmitted: false }]),
    ).toBeNull();
  });

  it('a day the partner closed and I did not is not a data point about us', () => {
    // partnerSubmitted is true but `theirs` is absent, because the day is not
    // revealed to me. It must not reach the figure.
    expect(coupleRangeAverage([{ date: '2026-09-22', mine: null, partnerSubmitted: true }])).toBeNull();
  });
});

describe('R-CALC-04 closed-together streak', () => {
  const both = (date: string): RangeDayInput => ({
    date,
    mine: { executionRating: 4, respectRating: 4 },
    partnerSubmitted: true,
    theirs: { executionRating: 4, respectRating: 4 },
  });
  const mineOnly = (date: string): RangeDayInput => ({
    date,
    mine: { executionRating: 4, respectRating: 4 },
    partnerSubmitted: false,
  });
  const theirsOnly = (date: string): RangeDayInput => ({ date, mine: null, partnerSubmitted: true });
  const neither = (date: string): RangeDayInput => ({ date, mine: null, partnerSubmitted: false });

  it('five both, today still open → 5', () => {
    const days = [both('d1'), both('d2'), both('d3'), both('d4'), both('d5'), neither('d6')];
    expect(closedTogetherStreak(days, 'd6')).toBe(5);
  });

  it('a gap before today → 0', () => {
    const days = [both('d1'), both('d2'), both('d3'), both('d4'), both('d5'), theirsOnly('d6'), neither('d7')];
    expect(closedTogetherStreak(days, 'd7')).toBe(0);
  });

  it('unbroken including today → 7', () => {
    const days = [both('d1'), both('d2'), both('d3'), both('d4'), both('d5'), both('d6'), both('d7')];
    expect(closedTogetherStreak(days, 'd7')).toBe(7);
  });

  it('nothing closed → 0', () => {
    expect(closedTogetherStreak([neither('d1'), neither('d2')], 'd2')).toBe(0);
  });

  it('only one of us closed today → the live day is skipped, earlier days count', () => {
    const days = [both('d1'), both('d2'), mineOnly('d3')];
    expect(closedTogetherStreak(days, 'd3')).toBe(2);
  });

  it('an unclosed day that is NOT today breaks the streak', () => {
    // The allowance is for the live day only. A yesterday nobody closed is a
    // real gap, even if the range happens to end there.
    const days = [both('d1'), both('d2'), neither('d3')];
    expect(closedTogetherStreak(days, 'd9')).toBe(0);
  });
});

describe('R-CALC-05 task completion for a range', () => {
  const task = (completedById: string | null) => ({ completedById });

  it('nine of twelve, six mine three theirs → 75%, split 67 / 33', () => {
    const tasks = [
      ...Array.from({ length: 6 }, () => task('me')),
      ...Array.from({ length: 3 }, () => task('them')),
      task(null),
      task(null),
      task(null),
    ];
    expect(taskCompletion(tasks, 'me')).toEqual({
      percent: 75,
      done: 9,
      total: 12,
      split: { mine: 67, theirs: 33 },
    });
  });

  it('thirds → the two percentages still sum to 100', () => {
    const result = taskCompletion([task('me'), task('them'), task('them')], 'me');
    expect(result.split).toEqual({ mine: 33, theirs: 67 });
    expect(result.split!.mine + result.split!.theirs).toBe(100);
  });

  it('no tasks in range → null percentage, not 0%', () => {
    expect(taskCompletion([], 'me')).toEqual({ percent: null, done: 0, total: 0 });
  });

  it('tasks but none done → 0% and no split', () => {
    expect(taskCompletion([task(null), task(null), task(null), task(null), task(null)], 'me')).toEqual({
      percent: 0,
      done: 0,
      total: 5,
    });
  });
});

describe('R-CALC-06 the best day of the month', () => {
  const day = (date: string, mine: [number, number], theirs: [number, number]): RangeDayInput => ({
    date,
    mine: { executionRating: mine[0], respectRating: mine[1] },
    partnerSubmitted: true,
    theirs: { executionRating: theirs[0], respectRating: theirs[1] },
  });

  it('picks the highest mean of all four ratings', () => {
    const days = [day('2026-09-01', [3, 3], [3, 3]), day('2026-09-05', [5, 5], [5, 4]), day('2026-09-09', [4, 4], [4, 4])];
    expect(bestDay(days)).toEqual({ date: '2026-09-05', average: 4.8 });
  });

  it('a tie resolves to the later date', () => {
    const days = [day('2026-09-01', [5, 5], [5, 5]), day('2026-09-20', [5, 5], [5, 5])];
    expect(bestDay(days)?.date).toBe('2026-09-20');
  });

  it('unrevealed days are not candidates', () => {
    expect(bestDay([{ date: '2026-09-01', mine: { executionRating: 5, respectRating: 5 }, partnerSubmitted: false }])).toBeNull();
  });

  it('nothing mutual → null', () => {
    expect(bestDay([])).toBeNull();
  });
});

describe('days closed together', () => {
  it('counts only the days both of us closed', () => {
    const days: RangeDayInput[] = [
      { date: 'a', mine: { executionRating: 4, respectRating: 4 }, partnerSubmitted: true },
      { date: 'b', mine: { executionRating: 4, respectRating: 4 }, partnerSubmitted: false },
      { date: 'c', mine: null, partnerSubmitted: true },
    ];
    expect(daysClosedTogether(days)).toBe(1);
  });
});

describe('range bounds', () => {
  it('the week runs Sunday to Saturday (the Hebrew week)', () => {
    // 2026-09-22 is a Tuesday; the week it belongs to starts Sunday the 20th.
    expect(weekBounds(d('2026-09-22'))).toEqual({ from: '2026-09-20', toExclusive: '2026-09-27' });
  });

  it('a Sunday is the first day of its own week, not the last of the previous one', () => {
    expect(weekBounds(d('2026-09-20')).from).toBe('2026-09-20');
  });

  it('a Saturday is the last day of its week', () => {
    expect(weekBounds(d('2026-09-26'))).toEqual({ from: '2026-09-20', toExclusive: '2026-09-27' });
  });

  it('the month is a calendar month, with the right length', () => {
    expect(monthBounds(d('2026-09-22'))).toEqual({ from: '2026-09-01', toExclusive: '2026-10-01' });
    expect(monthBounds(d('2026-02-15'))).toEqual({ from: '2026-02-01', toExclusive: '2026-03-01' });
  });

  it('February in a leap year has 29 days', () => {
    expect(monthBounds(d('2028-02-15'))).toEqual({ from: '2028-02-01', toExclusive: '2028-03-01' });
  });

  it('stepping back and forward returns to the same range', () => {
    const anchor = d('2026-09-22');
    for (const kind of ['week', 'month'] as const) {
      const back = shiftAnchor(kind, anchor, -1);
      const forward = shiftAnchor(kind, back, 1);
      expect(rangeKey(kind, forward)).toEqual(rangeKey(kind, anchor));
    }
  });

  function rangeKey(kind: 'week' | 'month', anchor: CalendarDate) {
    return kind === 'week' ? weekBounds(anchor) : monthBounds(anchor);
  }
});
