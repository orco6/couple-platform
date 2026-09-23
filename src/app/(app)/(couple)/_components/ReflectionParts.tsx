import Link from 'next/link';
import { ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { RangeDay } from '@/domain/day-entries/day-entries';
import type { PartnerRef } from '@/domain/partners';
import type { TrendDirection } from '@/domain/summaries/calculations';

/**
 * THE PIECES BOTH REFLECTIONS ARE BUILT FROM.
 *
 * The rule: **a relationship's week is read, not analysed.** One sentence
 * leads; one picture carries the shape of the days; a few facts follow as
 * sentences with their figure at the end of the line. The first edition was a
 * gradient KPI card, two stat cards and a list of icon tiles — a dashboard of
 * a marriage. What stayed is every figure it showed, each exactly once.
 */

/** Week | Month: two views of one destination. */
export function ReflectionTabs({ current }: { current: 'week' | 'month' }) {
  const tabs = [
    { key: 'week', href: '/week', label: copy.nav.week },
    { key: 'month', href: '/month', label: copy.nav.month },
  ] as const;
  return (
    <nav aria-label={copy.nav.reflection} className="mb-5 grid grid-cols-2 gap-1 rounded-control bg-sunken p-1 shadow-[inset_0_0_0_1px_var(--color-rule-faint)]">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'tap-quiet press flex min-h-10 items-center justify-center rounded-[10px] text-body transition-[background-color,color,box-shadow] duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
              active ? 'bg-surface font-semibold text-ink shadow-[var(--brand-shadow-card)]' : 'text-ink-muted',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
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

/** Previous at the start edge, next at the end — the reading direction. */
export function RangeStepper({
  from,
  to,
  kind,
  previousHref,
  nextHref,
}: {
  /** First and last day (ISO), also exposed as data attributes for tests and tools. */
  from: string;
  to: string;
  kind: 'week' | 'month';
  previousHref: string;
  nextHref: string | null;
}) {
  const button =
    'grid size-11 place-items-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <Link href={previousHref} aria-label={copy.summariesNav.previous} className={button}>
        <ChevronRight aria-hidden="true" size={20} />
      </Link>
      <p className="text-row font-medium text-ink" data-range-from={from} data-range-to={to}>
        <bdi>{rangeLabel(from, to, kind)}</bdi>
      </p>
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
  return <p className="mb-6 px-1 text-title leading-snug font-semibold text-balance text-ink">{children}</p>;
}

/** 1 → faint, 5 → full: how solid a person's circle is on a day. */
const STRENGTH = ['opacity-25', 'opacity-40', 'opacity-60', 'opacity-80', 'opacity-100'];

/**
 * THE WEEK'S RHYTHM — seven days, two circles each, in the product's own shape.
 *
 * My circle is solid in proportion to my answer; my partner's appears only on
 * a day that has been revealed to me (the `theirs` key is absent otherwise —
 * R-DAY-05 — and an absent value is drawn as an outline, never guessed). A day
 * nobody closed is two dashed rings, not a zero.
 */
export function Rhythm({ days, me, partner, today }: { days: RangeDay[]; me: PartnerRef; partner: PartnerRef | null; today: string }) {
  const byWeekday = new Map(days.map((day) => [new Date(`${day.date}T12:00:00Z`).getUTCDay(), day]));
  const fill = (side: 'a' | 'b') => (side === 'a' ? 'bg-partner-a' : 'bg-partner-b');
  const partnerName = partner?.name ?? copy.common.partnerFallback;

  return (
    <section className="panel mb-4 px-3 pt-4 pb-3" aria-labelledby="rhythm-title">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 id="rhythm-title" className="text-body font-semibold text-ink">
          {copy.reflection.rhythmTitle}
        </h2>
        <span className="flex items-center gap-3 text-meta text-ink-subtle" aria-hidden="true">
          <span className="flex items-center gap-1">
            <span className={cx('size-2.5 rounded-full', fill(me.side))} />
            {copy.common.me}
          </span>
          {partner && (
            <span className="flex items-center gap-1">
              <span className={cx('size-2.5 rounded-full', fill(partner.side))} />
              {partnerName}
            </span>
          )}
        </span>
      </div>

      <ol className="grid grid-cols-7">
        {copy.reflection.dayLetters.map((letter, weekday) => {
          const day = byWeekday.get(weekday);
          const mine = day?.mine?.respectRating ?? null;
          const theirs = day?.theirs?.respectRating ?? null;
          const isToday = day?.date === today;
          const future = !day || day.date > today;
          const describe = (value: number | null, hidden: boolean) =>
            value !== null ? copy.day.scale[value as 1 | 2 | 3 | 4 | 5] : hidden ? copy.reflection.hidden : copy.reflection.notClosed;

          return (
            <li key={letter} className="flex flex-col items-center gap-2">
              <span className="sr-only">
                {`${copy.reflection.dayNames[weekday]}: ${copy.common.me} ${describe(mine, false)}, ${partnerName} ${describe(theirs, Boolean(day?.partnerSubmitted))}`}
              </span>
              <span aria-hidden="true" className={cx('flex h-7 items-center', future && 'opacity-40')} dir="ltr">
                <Dot value={mine} className={fill(me.side)} />
                <Dot value={theirs} className={partner ? fill(partner.side) : ''} overlap />
              </span>
              <span
                aria-hidden="true"
                className={cx('text-meta', isToday ? 'font-semibold text-ink' : 'text-ink-subtle')}
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

function Dot({ value, className, overlap }: { value: number | null; className: string; overlap?: boolean }) {
  return (
    <span
      className={cx(
        'block size-5 rounded-full',
        overlap && '-ms-2',
        value === null ? 'border-[1.5px] border-dashed border-rule-strong' : cx(className, STRENGTH[value - 1]),
      )}
    />
  );
}

/**
 * One fact: what it is, a line of context, and the figure at the end of the
 * line. `figure` and `detail` are separate elements on purpose — the figure is
 * what the eye jumps to, and each has to be findable on its own.
 */
export function FactRow({
  label,
  detail,
  figure,
  suffix,
}: {
  label: string;
  detail?: ReactNode;
  figure: string | null;
  suffix?: string;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="block min-w-0">
          <span className="block text-row font-medium text-ink">{label}</span>
          {detail && <span className="block text-meta text-ink-subtle">{detail}</span>}
        </span>
        <p className="flex shrink-0 items-baseline gap-1 tabular-nums" dir="ltr">
          <span className="text-section font-semibold text-ink">{figure ?? '—'}</span>
          {suffix && figure !== null && <span className="text-meta text-ink-subtle" dir="rtl">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

/** A month's direction as one small line, with the word that says it. */
export function TrendRow({
  title,
  values,
  direction,
  min,
  max,
}: {
  title: string;
  values: readonly (number | null)[];
  direction: TrendDirection;
  min: number;
  max: number;
}) {
  const W = 120;
  const H = 32;
  const points = values.flatMap((value, index) => {
    if (value === null) return [];
    const x = values.length <= 1 ? W / 2 : (index / (values.length - 1)) * (W - 8) + 4;
    const y = H - 5 - ((value - min) / Math.max(1, max - min)) * (H - 10);
    return [{ x, y }];
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const word = direction === 'up' ? copy.month.trendUp : direction === 'down' ? copy.month.trendDown : copy.month.trendFlat;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-row font-medium text-ink">{title}</p>
        <p className="flex items-center gap-1 text-meta text-ink-subtle">
          <Icon aria-hidden="true" size={13} className="rtl:-scale-x-100" />
          {word}
        </p>
      </div>
      {points.length < 2 ? (
        <span className="text-meta text-ink-subtle">{copy.month.noData}</span>
      ) : (
        // Time runs in the reading direction, like the week's days above it.
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0 text-ink rtl:-scale-x-100" role="img" aria-label={`${title}: ${word}`}>
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r="2.5" className="fill-surface" stroke="currentColor" strokeWidth="1.75" />
          ))}
        </svg>
      )}
    </div>
  );
}
