'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { cx } from '@/core/ui/cx';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';

/**
 * A MONTH TO TOUCH — the date picker for a task.
 *
 * The browser's date field was unreliable on a real iPhone (sometimes a text
 * field, sometimes a wheel, never obviously a calendar). This is a calendar
 * you can see: the month, the seven Hebrew weekday letters, and every day a
 * 44px target. Today is ringed; the chosen day is filled. Previous month sits
 * at the inline start (right), next at the end — the reading direction.
 * No typing, no keyboard.
 */
const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fullDay = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function parts(date: CalendarDate) {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y!, m: m! - 1, d: d! };
}

function iso(y: number, m: number, d: number): CalendarDate {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` as CalendarDate;
}

export function Calendar({
  value,
  today,
  onPick,
}: {
  value: CalendarDate;
  today: CalendarDate;
  onPick: (date: CalendarDate) => void;
}) {
  const start = parts(value);
  const [view, setView] = useState({ y: start.y, m: start.m });

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = first.getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];

  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const next = new Date(Date.UTC(y, m + delta, 1));
      return { y: next.getUTCFullYear(), m: next.getUTCMonth() };
    });

  const nav =
    'tap-quiet press grid size-11 place-items-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-focus';

  return (
    <div className="calendar" data-testid="calendar">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label={copy.tasks.previousMonth} className={nav}>
          <ChevronRight aria-hidden="true" size={20} />
        </button>
        <p className="text-row font-semibold text-ink" aria-live="polite">
          {monthName.format(first)}
        </p>
        <button type="button" onClick={() => shift(1)} aria-label={copy.tasks.nextMonth} className={nav}>
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
      </div>

      <div aria-hidden="true" className="mt-1 grid grid-cols-7 text-center text-meta text-ink-subtle">
        {copy.reflection.dayLetters.map((letter) => (
          <span key={letter} className="py-1">
            {letter}
          </span>
        ))}
      </div>

      <div role="group" aria-label={monthName.format(first)} className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, index) => {
          if (day === null) return <span key={`lead-${index}`} />;
          const date = iso(view.y, view.m, day);
          const selected = date === value;
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPick(date)}
              aria-pressed={selected}
              aria-label={fullDay.format(new Date(`${date}T12:00:00Z`))}
              aria-current={isToday ? 'date' : undefined}
              className={cx(
                'tap-quiet press mx-auto grid size-11 place-items-center rounded-full text-row tabular-nums transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                selected
                  ? 'bg-accent font-semibold text-on-accent'
                  : isToday
                    ? 'font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]'
                    : 'text-ink',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
