import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
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
      <span className="glass inline-flex gap-1 rounded-full bg-[var(--brand-glass-strong)] p-1">
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

/* ═══ Fifth edition: the numbers, plainly ══════════════════════════════════
   The owner asked for a summary they can read exactly: what got done, by
   whom, on which day, and how it went. So each block is a titled card with
   its figure written out ("18 מתוך 24"), a bar where proportion helps, and
   nothing symbolic that needs decoding. */

/** A titled block on the one frosted surface. */
export function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="figure-card mt-4 px-4 pt-3.5 pb-4" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-semibold text-ink-muted">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

type Tally = { done: number; total: number };

/**
 * The headline figure of a period: done out of total, large, then a bar split
 * by whose tasks they were, then one line per person.
 */
export function TasksDone({
  total,
  byOwner,
  me,
  partner,
}: {
  total: Tally;
  byOwner: (Tally & { ownerId: string })[];
  me: PartnerRef;
  partner: PartnerRef | null;
}) {
  const people = partner ? [me, partner] : [me];
  const personOf = (id: string) => people.find((person) => person.id === id) ?? me;
  const share = (count: number) => (total.total === 0 ? 0 : (count / total.total) * 100);
  return (
    <>
      <p className="mt-1 text-[2rem] leading-tight font-bold text-ink tabular-nums">
        <span>{copy.week.completionDetail(total.done, total.total)}</span>
      </p>
      <div aria-hidden="true" dir="rtl" className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-rule)]">
        {byOwner.map((row) => (
          <span
            key={row.ownerId}
            className={cx('h-full', personOf(row.ownerId).side === 'a' ? 'bg-partner-a' : 'bg-partner-b')}
            style={{ width: `${share(row.done)}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {byOwner.map((row) => {
          const person = personOf(row.ownerId);
          return (
            <li key={row.ownerId} className="flex items-center justify-between gap-3 text-row">
              <span className="flex items-center gap-2 text-ink">
                <span aria-hidden="true" className={cx(person.side === 'a' ? 'light-a' : 'light-b', 'size-3')} />
                {person.id === me.id ? copy.reflection.mineLabel : copy.reflection.theirsLabel(person.name.split(' ')[0] ?? person.name)}
              </span>
              <span className="font-semibold text-ink tabular-nums">{copy.week.completionDetail(row.done, row.total)}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Day by day: one column per day, Sunday at the right. The column's height is
 * how many tasks the day had (against the busiest day); the filled part is how
 * many were done. The figure sits under it, so nothing has to be estimated.
 */
export function DayBars({ byDay, today }: { byDay: (Tally & { date: string })[]; today: string }) {
  const most = Math.max(1, ...byDay.map((day) => day.total));
  const H = 88;
  return (
    <ol className="mt-3 grid grid-cols-7 gap-1.5">
      {byDay.map((day) => {
        const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
        const future = day.date > today;
        const height = day.total === 0 ? 0 : Math.max(10, (day.total / most) * H);
        const filled = day.total === 0 ? 0 : (day.done / day.total) * 100;
        return (
          <li key={day.date} className="flex flex-col items-center">
            <span className="sr-only">{`${copy.reflection.dayNames[weekday]}: ${copy.week.completionDetail(day.done, day.total)}`}</span>
            <span aria-hidden="true" className="flex w-full items-end justify-center" style={{ height: H }}>
              {day.total === 0 ? (
                <span className="mb-0.5 block h-1 w-5 rounded-full bg-[var(--color-rule)]" />
              ) : (
                <span className="relative block w-6 overflow-hidden rounded-t-[0.5rem] rounded-b-[0.25rem] bg-[var(--color-rule)]" style={{ height }}>
                  <span className="absolute inset-x-0 bottom-0 block bg-accent" style={{ height: `${filled}%` }} />
                </span>
              )}
            </span>
            <span aria-hidden="true" className={cx('mt-1.5 text-meta', day.date === today ? 'font-bold text-ink' : 'text-ink-muted', future && 'opacity-60')}>
              {copy.reflection.dayLetters[weekday]}
            </span>
            <span aria-hidden="true" className="text-[0.6875rem] text-ink-muted tabular-nums" dir="ltr">
              {day.total === 0 ? '–' : `${day.done}/${day.total}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One figure per line: what it is, then its value. */
export function Figure({ label, value, suffix, hint }: { label: string; value: string | null; suffix?: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-row text-ink">{label}</span>
        {hint && <span className="block text-meta text-ink-muted">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
        <span className="text-section font-bold text-ink">{value ?? '—'}</span>
        {suffix && value !== null && <span className="text-meta text-ink-muted">{suffix}</span>}
      </span>
    </div>
  );
}

const shortRange = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

/** The month, week by week: label and dates, a bar, and the two figures. */
export function WeekRows({
  weeks,
}: {
  weeks: { index: number; from: string; done: number; total: number; respectAverage: number | null }[];
}) {
  return (
    <ol aria-label={copy.month.weeklyAveragesTitle} className="mt-2 divide-y divide-rule-faint">
      {weeks.map((week) => (
        <li key={week.from} className="flex items-center gap-3 py-2.5">
          <span className="w-[3.75rem] shrink-0">
            <span className="block text-body font-semibold text-ink">{copy.month.weekLabel(week.index)}</span>
            <bdi className="block text-meta text-ink-muted" dir="ltr">
              {shortRange.format(new Date(`${week.from}T12:00:00Z`))}
            </bdi>
          </span>
          <span aria-hidden="true" dir="rtl" className="block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-rule)]">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${week.total === 0 ? 0 : (week.done / week.total) * 100}%` }} />
          </span>
          <span className="w-[5.5rem] shrink-0 whitespace-nowrap text-end text-body font-semibold text-ink tabular-nums">
            {week.total === 0 ? '—' : copy.week.completionDetail(week.done, week.total)}
          </span>
          <span className="w-10 shrink-0 text-end text-meta text-ink-muted tabular-nums">
            {week.respectAverage === null ? '—' : week.respectAverage.toFixed(1)}
          </span>
        </li>
      ))}
    </ol>
  );
}
