import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { RangeDay } from '@/domain/day-entries/day-entries';
import type { PartnerRef } from '@/domain/partners';

/**
 * THE PIECES BOTH REFLECTIONS ARE BUILT FROM.
 *
 * The rule: **a relationship's week is told, not reported.** One sentence
 * leads; one picture carries the days — each day a light in the colour of the
 * answer it was given, the same dusk-to-morning colours the daily question
 * lights the room with; a few facts follow; one thought closes. No cards, no
 * trend lines, no percentages. The figures that remain are each shown once.
 */

/** Week | Month: two views of one destination, as one quiet switch. */
export function ReflectionTabs({ current }: { current: 'week' | 'month' }) {
  const tabs = [
    { key: 'week', href: '/week', label: copy.nav.week },
    { key: 'month', href: '/month', label: copy.nav.month },
  ] as const;
  return (
    <nav aria-label={copy.nav.reflection} className="mb-6 flex justify-center">
      <span className="glass inline-flex gap-1 rounded-full p-1">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'tap-quiet press flex min-h-9 min-w-20 items-center justify-center rounded-full px-4 text-body transition-[background-color,color] duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                active ? 'bg-accent font-semibold text-on-accent' : 'text-ink-muted',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </span>
    </nav>
  );
}

const dayMonth = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A range as people say it: "20-26 בספטמבר", "27 בספטמבר - 3 באוקטובר",
 * "ספטמבר 2026". The first edition printed "20.09.2026 — 26.09.2026", which
 * is how software says it.
 */
export function rangeLabel(from: string, to: string, kind: 'week' | 'month'): string {
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  if (kind === 'month') return monthYear.format(a);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}-${dayMonth.format(b)}`;
  return `${dayMonth.format(a)} - ${dayMonth.format(b)}`;
}

/**
 * The page's name and the range it covers, between previous (start edge) and
 * next (end edge) — the reading direction.
 */
export function RangeStepper({
  title,
  from,
  to,
  kind,
  previousHref,
  nextHref,
}: {
  title: string;
  /** First and last day (ISO), also exposed as data attributes for tests and tools. */
  from: string;
  to: string;
  kind: 'week' | 'month';
  previousHref: string;
  nextHref: string | null;
}) {
  const button =
    'tap-quiet press grid size-11 place-items-center rounded-full text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={previousHref} aria-label={copy.summariesNav.previous} className={button}>
        <ChevronRight aria-hidden="true" size={20} />
      </Link>
      <div className="min-w-0 text-center">
        <h1 className="text-body font-semibold text-ink">{title}</h1>
        <p className="text-meta text-ink-subtle" data-range-from={from} data-range-to={to}>
          <bdi>{rangeLabel(from, to, kind)}</bdi>
        </p>
      </div>
      {nextHref ? (
        <Link href={nextHref} aria-label={copy.summariesNav.next} className={button}>
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
      ) : (
        <span className="size-11" aria-hidden="true" />
      )}
    </div>
  );
}

/** The sentence a reflection hangs on. */
export function Story({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-8 max-w-sm text-center text-[1.875rem] leading-tight font-semibold text-balance text-ink">
      {children}
    </p>
  );
}

type Rating = 1 | 2 | 3 | 4 | 5;
const word = (value: number) => copy.day.scale[value as Rating];

/** A lit bead in the colour of an answer — the ritual's own colours. */
function lit(value: number, size: number): CSSProperties {
  const colour = `var(--orb-day-${value})`;
  return {
    width: size,
    height: size,
    background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${colour} 45%, white), ${colour} 72%)`,
    boxShadow: `0 6px 16px -6px ${colour}`,
  };
}

/** An answer that is not there (not closed yet, or not revealed): a ring, never a guess. */
function Ring({ size }: { size: number }) {
  return (
    <span
      className="block rounded-full border-[1.5px] border-dashed border-rule-strong"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * THE WEEK — seven days, two lights each: mine above, my partner's below.
 *
 * A light's size and colour are the answer (1 small and dusk-blue, 5 full and
 * morning-orange). My partner's light appears only on a day that has been
 * revealed to me (the `theirs` key is absent otherwise — R-DAY-05); an absent
 * answer is a dashed ring, and a day still ahead is a faint point.
 */
export function WeekLights({
  days,
  partner,
  today,
}: {
  days: RangeDay[];
  partner: PartnerRef | null;
  today: string;
}) {
  const byWeekday = new Map(days.map((day) => [new Date(`${day.date}T12:00:00Z`).getUTCDay(), day]));
  const partnerName = partner?.name ?? copy.common.partnerFallback;
  const size = (value: number) => 16 + value * 4;

  return (
    <section className="mt-10" aria-label={copy.reflection.rhythmTitle}>
      <ol className="grid grid-cols-7">
        {copy.reflection.dayLetters.map((letter, weekday) => {
          const day = byWeekday.get(weekday);
          const mine = day?.mine?.respectRating ?? null;
          const theirs = day?.theirs?.respectRating ?? null;
          const isToday = day?.date === today;
          const future = !day || day.date > today;
          const describe = (value: number | null, hidden: boolean) =>
            value !== null ? word(value) : hidden ? copy.reflection.hidden : copy.reflection.notClosed;

          return (
            <li key={letter} className="flex flex-col items-center">
              <span className="sr-only">
                {`${copy.reflection.dayNames[weekday]}: ${copy.common.me} ${describe(mine, false)}, ${partnerName} ${describe(theirs, Boolean(day?.partnerSubmitted))}`}
              </span>
              <span aria-hidden="true" className="flex h-[4.75rem] flex-col items-center justify-center">
                {future ? (
                  <span className="block size-1.5 rounded-full bg-rule-strong" />
                ) : (
                  <>
                    {mine === null ? <Ring size={20} /> : <span className="block rounded-full" style={lit(mine, size(mine))} />}
                    <span className="-mt-2">
                      {theirs === null ? <Ring size={20} /> : <span className="block rounded-full" style={lit(theirs, size(theirs))} />}
                    </span>
                  </>
                )}
              </span>
              <span
                aria-hidden="true"
                className={cx('mt-2 text-meta', isToday ? 'font-semibold text-ink' : 'text-ink-subtle')}
              >
                {letter}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * THE MONTH — the days as a field of lights, week under week.
 *
 * One light per day: the colour of the answer we both gave (their mean) once
 * the day is revealed, or of mine alone, dimmer, while it is not. No numbers,
 * no axis; the colour moving from blue to orange down the rows is the trend.
 */
export function MonthLights({ days, today }: { days: RangeDay[]; today: string }) {
  const weeks: (RangeDay | null)[][] = [];
  for (const day of days) {
    const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    if (weeks.length === 0 || weekday === 0) weeks.push(Array.from({ length: 7 }, () => null));
    weeks[weeks.length - 1]![weekday] = day;
  }

  const valueOf = (day: RangeDay): { value: number; together: boolean } | null => {
    if (!day.mine) return null;
    if (day.theirs) return { value: Math.round((day.mine.respectRating + day.theirs.respectRating) / 2), together: true };
    return { value: day.mine.respectRating, together: false };
  };

  return (
    <section className="mt-10">
      <p aria-hidden="true" className="grid grid-cols-7 text-center text-meta text-ink-subtle">
        {copy.reflection.dayLetters.map((letter) => (
          <span key={letter}>{letter}</span>
        ))}
      </p>
      <ol aria-label={copy.month.weeklyAveragesTitle} className="mt-2 space-y-2">
        {weeks.map((week, index) => {
          const closed = week.flatMap((day) => (day ? [valueOf(day)] : [])).filter((v) => v !== null);
          const mean = closed.length === 0 ? null : Math.round(closed.reduce((sum, v) => sum + v.value, 0) / closed.length);
          return (
            <li key={index} className="grid grid-cols-7">
              <span className="sr-only">
                {`${copy.month.weekLabel(index + 1)}: ${mean === null ? copy.reflection.notClosed : word(mean)}`}
              </span>
              {week.map((day, weekday) => {
                const v = day && day.date <= today ? valueOf(day) : null;
                return (
                  <span key={weekday} aria-hidden="true" className="grid h-11 place-items-center">
                    {!day ? null : v ? (
                      <span
                        className={cx('block rounded-full', !v.together && 'opacity-55', day.date === today && 'ring-2 ring-ink ring-offset-2 ring-offset-transparent')}
                        style={lit(v.value, 30)}
                      />
                    ) : (
                      <span
                        className={cx('block size-1.5 rounded-full bg-rule-strong', day.date > today && 'opacity-50')}
                      />
                    )}
                  </span>
                );
              })}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** A few facts, each a line: what it is, and its figure at the end. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="mt-10 divide-y divide-rule-faint">{children}</dl>;
}

export function Fact({ label, figure, suffix }: { label: string; figure: string | null; suffix?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 py-3">
      <dt className="text-row text-ink-muted">{label}</dt>
      <dd className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
        <span className="text-section font-semibold text-ink">{figure ?? '—'}</span>
        {suffix && figure !== null && <span className="text-meta text-ink-subtle">{suffix}</span>}
      </dd>
    </div>
  );
}

/** The one thought the week ends on. */
export function Thought({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 px-1 text-center">
      <h2 className="text-meta font-semibold text-ink-subtle">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-row text-balance text-ink">{children}</p>
    </section>
  );
}
