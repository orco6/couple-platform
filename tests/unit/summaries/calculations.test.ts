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
  completion,
  coupleRespectAverage,
  daysClosedTogether,
  executionAverage,
  myRespectAverage,
  respectDipped,
  trend,
  unratedCompletedCount,
  weeklyInsight,
  type RangeDayInput,
  type TaskInput,
} from '@/domain/summaries/calculations';
import { monthBounds, shiftMonth, shiftWeek, weekBounds } from '@/domain/summaries/summaries';
import type { CalendarDate } from '@/core/dates/calendar-date';

const d = (value: string) => value as CalendarDate;

const ME = 'me';
const THEM = 'them';

function task(overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    taskDate: '2026-09-21',
    title: 'משימה',
    ownerId: ME,
    completedById: null,
    ratingValue: null,
    ...overrides,
  };
}

const bothClosed = (date: string, mine = 4, theirs = 4): RangeDayInput => ({
  date,
  mine: { respectRating: mine },
  partnerSubmitted: true,
  theirs: { respectRating: theirs },
});
const mineOnly = (date: string, mine = 4): RangeDayInput => ({ date, mine: { respectRating: mine }, partnerSubmitted: false });
const theirsOnly = (date: string): RangeDayInput => ({ date, mine: null, partnerSubmitted: true });
const neither = (date: string): RangeDayInput => ({ date, mine: null, partnerSubmitted: false });

describe('R-CALC-01 how the list went', () => {
  it('nine of twelve done, eight owned by me → 75%, share 67 / 33', () => {
    const tasks = [
      ...Array.from({ length: 8 }, () => task({ ownerId: ME, completedById: ME })),
      ...Array.from({ length: 1 }, () => task({ ownerId: THEM, completedById: THEM })),
      task({ ownerId: THEM }),
      task({ ownerId: THEM }),
      task({ ownerId: THEM }),
    ];
    const result = completion(tasks, ME);
    expect(result.percent).toBe(75);
    expect(result.done).toBe(9);
    expect(result.total).toBe(12);
    expect(result.ownerShare).toEqual({ mine: 67, theirs: 33 });
  });

  it('the share is about responsibility, not who ticked the box', () => {
    // I completed both, but they were their tasks. The share must say 0/100.
    const tasks = [task({ ownerId: THEM, completedById: ME }), task({ ownerId: THEM, completedById: ME })];
    expect(completion(tasks, ME).ownerShare).toEqual({ mine: 0, theirs: 100 });
  });

  it('the two share percentages always sum to 100', () => {
    const tasks = [task({ ownerId: ME }), task({ ownerId: THEM }), task({ ownerId: THEM })];
    const share = completion(tasks, ME).ownerShare!;
    expect(share).toEqual({ mine: 33, theirs: 67 });
    expect(share.mine + share.theirs).toBe(100);
  });

  it('no tasks in range → null percentage, not 0%', () => {
    expect(completion([], ME)).toEqual({ percent: null, done: 0, total: 0 });
  });

  it('tasks but none done → 0%', () => {
    expect(completion([task(), task()], ME).percent).toBe(0);
  });
});

describe('R-CALC-02 the average task-execution rating', () => {
  it('rated 5, 4 and 3 → 4.0', () => {
    const tasks = [
      task({ completedById: ME, ratingValue: 5 }),
      task({ completedById: ME, ratingValue: 4 }),
      task({ completedById: ME, ratingValue: 3 }),
    ];
    expect(executionAverage(tasks)).toBe(4);
  });

  it('an unrated completed task is silence, not a zero', () => {
    // Two 5s and one unrated must stay 5.0, not drop to 3.3.
    const tasks = [
      task({ completedById: ME, ratingValue: 5 }),
      task({ completedById: ME, ratingValue: 5 }),
      task({ completedById: ME, ratingValue: null }),
    ];
    expect(executionAverage(tasks)).toBe(5);
    expect(unratedCompletedCount(tasks)).toBe(1);
  });

  it('nothing rated → null', () => {
    expect(executionAverage([task({ completedById: ME })])).toBeNull();
  });

  it('a rating on a task that was reopened does not count', () => {
    // The rating row survives a reopen (R-RATE-03 removes nothing), but the
    // figure is about finished work, and this task is back on the list.
    const tasks = [
      task({ completedById: ME, ratingValue: 4 }),
      task({ completedById: null, ratingValue: 1 }),
    ];
    expect(executionAverage(tasks)).toBe(4);
    // And it is not waiting for a rating either — it already has one.
    expect(unratedCompletedCount(tasks)).toBe(0);
  });

  it('every rated task reopened → null, not a figure about nothing', () => {
    expect(executionAverage([task({ completedById: null, ratingValue: 5 })])).toBeNull();
  });

  it('rounds to one decimal, half away from zero', () => {
    // 4 + 3 + 3 + 3 = 13 over 4 → 3.25 → 3.3
    const tasks = [4, 3, 3, 3].map((value) => task({ completedById: ME, ratingValue: value }));
    expect(executionAverage(tasks)).toBe(3.3);
  });
});

describe('R-CALC-03 the couple mutual-respect average', () => {
  const days = [bothClosed('2026-09-21', 4, 3), mineOnly('2026-09-22', 5)];

  it('one mutual day, one single → mean of 4 and 3 = 3.5', () => {
    expect(coupleRespectAverage(days)).toBe(3.5);
  });

  it('and my own average on the same data is a different question → 4.5', () => {
    expect(myRespectAverage(days)).toBe(4.5);
  });

  it('a day the partner closed and I did not is not a data point about us', () => {
    expect(coupleRespectAverage([theirsOnly('2026-09-22')])).toBeNull();
  });

  it('nothing mutual → null', () => {
    expect(coupleRespectAverage([mineOnly('2026-09-22')])).toBeNull();
  });
});

describe('R-CALC-04 closed-together streak', () => {
  it('five both, today still open → 5', () => {
    const days = [bothClosed('d1'), bothClosed('d2'), bothClosed('d3'), bothClosed('d4'), bothClosed('d5'), neither('d6')];
    expect(closedTogetherStreak(days, 'd6')).toBe(5);
  });

  it('a gap before today → 0', () => {
    const days = [bothClosed('d1'), bothClosed('d2'), theirsOnly('d3'), neither('d4')];
    expect(closedTogetherStreak(days, 'd4')).toBe(0);
  });

  it('unbroken including today → 7', () => {
    const days = Array.from({ length: 7 }, (_unused, index) => bothClosed(`d${index + 1}`));
    expect(closedTogetherStreak(days, 'd7')).toBe(7);
  });

  it('only one of us closed today → the live day is skipped, earlier days count', () => {
    expect(closedTogetherStreak([bothClosed('d1'), bothClosed('d2'), mineOnly('d3')], 'd3')).toBe(2);
  });

  it('an unclosed day that is NOT today breaks the streak', () => {
    expect(closedTogetherStreak([bothClosed('d1'), bothClosed('d2'), neither('d3')], 'd9')).toBe(0);
  });

  it('nothing closed → 0', () => {
    expect(closedTogetherStreak([neither('d1')], 'd1')).toBe(0);
  });

  it('days that have not happened yet are not gaps', () => {
    // The current week's range runs to Saturday. On a Tuesday it contains four
    // future days, and counting them as gaps showed "0" to a couple who had
    // closed every day so far.
    const week = [
      bothClosed('2026-09-20'),
      bothClosed('2026-09-21'),
      bothClosed('2026-09-22'),
      neither('2026-09-23'),
      neither('2026-09-24'),
      neither('2026-09-25'),
      neither('2026-09-26'),
    ];
    expect(closedTogetherStreak(week, '2026-09-22')).toBe(3);
  });

  it('today still gets its one allowance, with future days after it', () => {
    const week = [
      bothClosed('2026-09-20'),
      bothClosed('2026-09-21'),
      neither('2026-09-22'),
      neither('2026-09-23'),
    ];
    expect(closedTogetherStreak(week, '2026-09-22')).toBe(2);
  });
});

describe('R-CALC-05 the best day', () => {
  it('picks the highest couple average', () => {
    const days = [bothClosed('2026-09-01', 3, 3), bothClosed('2026-09-05', 5, 4), bothClosed('2026-09-09', 4, 4)];
    expect(bestDay(days)).toEqual({ date: '2026-09-05', average: 4.5 });
  });

  it('a tie resolves to the later date', () => {
    const days = [bothClosed('2026-09-01', 5, 5), bothClosed('2026-09-20', 5, 5)];
    expect(bestDay(days)?.date).toBe('2026-09-20');
  });

  it('unrevealed days are not candidates', () => {
    expect(bestDay([mineOnly('2026-09-01', 5)])).toBeNull();
  });
});

describe('R-CALC-06 did respect dip across the range', () => {
  it('a whole point of decline over enough closed days is reported', () => {
    const days = [bothClosed('d1', 5, 5), bothClosed('d2', 5, 5), bothClosed('d3', 3, 3), bothClosed('d4', 3, 3)];
    expect(respectDipped(days)).toBe(true);
  });

  it('a small wobble is not', () => {
    const days = [bothClosed('d1', 4, 4), bothClosed('d2', 4, 4), bothClosed('d3', 4, 3), bothClosed('d4', 4, 4)];
    expect(respectDipped(days)).toBe(false);
  });

  it('fewer than four closed days is never enough to claim a trend', () => {
    const days = [bothClosed('d1', 5, 5), bothClosed('d2', 1, 1)];
    expect(respectDipped(days)).toBe(false);
  });
});

describe('trend direction', () => {
  it('needs two points', () => {
    expect(trend([null, 4])).toBe('flat');
    expect(trend([4])).toBe('flat');
  });

  it('ignores movement inside the dead band', () => {
    expect(trend([4, 4.2])).toBe('flat');
  });

  it('reports up and down', () => {
    expect(trend([3, 4.5])).toBe('up');
    expect(trend([4.5, 3])).toBe('down');
  });

  it('percentages use a wider dead band when asked to', () => {
    expect(trend([60, 65], 8)).toBe('flat');
    expect(trend([60, 80], 8)).toBe('up');
  });
});

describe('R-CALC-07 the one gentle insight', () => {
  const closedWeek = Array.from({ length: 5 }, (_unused, index) => bothClosed(`d${index + 1}`));

  it('unrated tasks come first — the cheapest fix, and someone is waiting', () => {
    const tasks = [task({ completedById: ME, ratingValue: null }), task({ completedById: ME, ratingValue: 4 })];
    const insight = weeklyInsight({ tasks, days: closedWeek, completion: completion(tasks, ME), myId: ME });
    expect(insight).toEqual({ key: 'unratedTasks', count: 1 });
  });

  it('then a list nobody could finish', () => {
    const tasks = [
      task({ completedById: ME, ratingValue: 4 }),
      task({ ownerId: THEM }),
      task({ ownerId: THEM }),
      task({ ownerId: ME }),
      task({ ownerId: THEM }),
    ];
    expect(weeklyInsight({ tasks, days: closedWeek, completion: completion(tasks, ME), myId: ME }).key).toBe('lowCompletion');
  });

  it('then an unbalanced week, naming whose share it was', () => {
    const tasks = Array.from({ length: 4 }, () => task({ ownerId: ME, completedById: ME, ratingValue: 4 }));
    const insight = weeklyInsight({ tasks, days: closedWeek, completion: completion(tasks, ME), myId: ME });
    expect(insight).toEqual({ key: 'unbalancedTasks', heavierOwnerIsMe: true });
  });

  it('then too few days closed together', () => {
    const tasks = [task({ ownerId: ME, completedById: ME, ratingValue: 4 }), task({ ownerId: THEM, completedById: THEM, ratingValue: 4 })];
    const days = [bothClosed('d1'), mineOnly('d2'), neither('d3')];
    expect(weeklyInsight({ tasks, days, completion: completion(tasks, ME), myId: ME }).key).toBe('fewClosedDays');
  });

  it('a real dip is reported last, because the others are likelier to be the cause', () => {
    const tasks = [task({ ownerId: ME, completedById: ME, ratingValue: 4 }), task({ ownerId: THEM, completedById: THEM, ratingValue: 4 })];
    const days = [bothClosed('d1', 5, 5), bothClosed('d2', 5, 5), bothClosed('d3', 3, 3), bothClosed('d4', 3, 3)];
    expect(weeklyInsight({ tasks, days, completion: completion(tasks, ME), myId: ME }).key).toBe('respectDip');
  });

  it('a good week says so, and says nothing else', () => {
    const tasks = [task({ ownerId: ME, completedById: ME, ratingValue: 5 }), task({ ownerId: THEM, completedById: THEM, ratingValue: 5 })];
    expect(weeklyInsight({ tasks, days: closedWeek, completion: completion(tasks, ME), myId: ME }).key).toBe('allGood');
  });
});

describe('days closed together', () => {
  it('counts only the days both of us closed', () => {
    expect(daysClosedTogether([bothClosed('a'), mineOnly('b'), theirsOnly('c')])).toBe(1);
  });
});

describe('range bounds', () => {
  it('the week runs Sunday to Saturday, so Saturday is the end-of-week review', () => {
    // 2026-09-22 is a Tuesday; its week starts Sunday the 20th and the last
    // day inside it is Saturday the 26th.
    expect(weekBounds(d('2026-09-22'))).toEqual({ from: '2026-09-20', toExclusive: '2026-09-27' });
  });

  it('a Sunday starts its own week; a Saturday ends it', () => {
    expect(weekBounds(d('2026-09-20')).from).toBe('2026-09-20');
    expect(weekBounds(d('2026-09-26'))).toEqual({ from: '2026-09-20', toExclusive: '2026-09-27' });
  });

  it('the month is a calendar month, with the right length', () => {
    expect(monthBounds(d('2026-09-22'))).toEqual({ from: '2026-09-01', toExclusive: '2026-10-01' });
    expect(monthBounds(d('2026-02-15'))).toEqual({ from: '2026-02-01', toExclusive: '2026-03-01' });
    expect(monthBounds(d('2028-02-15'))).toEqual({ from: '2028-02-01', toExclusive: '2028-03-01' });
  });

  it('stepping back and forward returns to the same range', () => {
    const anchor = d('2026-09-22');
    expect(weekBounds(shiftWeek(shiftWeek(anchor, -1), 1))).toEqual(weekBounds(anchor));
    expect(monthBounds(shiftMonth(shiftMonth(anchor, -1), 1))).toEqual(monthBounds(anchor));
  });
});
