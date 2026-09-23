'use client';

import { useRef } from 'react';

import { cx } from '@/core/ui/cx';

import { tick } from './motion';

/**
 * THE ORBS — how both 1–5 answers in the product are given.
 *
 * Five lights, each a little larger than the last, so "more" is seen before it
 * is read. Choosing one lights it and every light before it; the chosen one
 * swells and glows, and its word appears in a slot that never changes height.
 * For a task the lights are the colour of the person who did it; for the day
 * they run from dusk (1) to dawn (5). No stars, no faces, no numbers on screen.
 *
 * Underneath, a real radiogroup: one tab stop (roving tabindex), arrows move
 * the choice and the focus together, Home/End, every orb its own ≥44px target,
 * and each radio named "4 — טוב". Drawn LTR in both languages (a magnitude
 * axis): ArrowRight means more.
 */
const STEPS = [1, 2, 3, 4, 5] as const;
export type RatingValue = (typeof STEPS)[number];

export type OrbTone = 'a' | 'b' | 'day';

/** The day's five lights, dusk → dawn. Token-driven through CSS variables. */
const DAY = ['--orb-day-1', '--orb-day-2', '--orb-day-3', '--orb-day-4', '--orb-day-5'];

function nextStep(key: string, from: RatingValue): RatingValue | null {
  if (key === 'Home') return 1;
  if (key === 'End') return 5;
  const delta = key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : 0;
  if (delta === 0) return null;
  return Math.min(5, Math.max(1, from + delta)) as RatingValue;
}

export function Orbs({
  value,
  onChange,
  labels,
  legend,
  tone,
  size = 'md',
  showWord = true,
}: {
  value: RatingValue | null;
  onChange: (value: RatingValue) => void;
  labels: Record<RatingValue, string>;
  legend: string;
  tone: OrbTone;
  size?: 'md' | 'lg';
  showWord?: boolean;
}) {
  const group = useRef<HTMLDivElement>(null);
  const base = size === 'lg' ? 30 : 22;
  const growth = size === 'lg' ? 8 : 6;
  const target = size === 'lg' ? 64 : 52;

  function choose(next: RatingValue) {
    if (next === value) return;
    onChange(next);
    tick();
  }

  const colour = (step: number) =>
    tone === 'day' ? `var(${DAY[step - 1]})` : tone === 'a' ? 'var(--brand-partner-a)' : 'var(--brand-partner-b)';

  return (
    <div>
      <div ref={group} role="radiogroup" aria-label={legend} dir="ltr" className="flex items-center justify-center gap-1">
        {STEPS.map((step) => {
          const lit = value !== null && step <= value;
          const chosen = value === step;
          const diameter = base + (step - 1) * growth;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={`${step} — ${labels[step]}`}
              tabIndex={chosen || (value === null && step === 1) ? 0 : -1}
              onClick={() => choose(step)}
              onKeyDown={(event) => {
                const next = nextStep(event.key, step);
                if (next === null) return;
                event.preventDefault();
                choose(next);
                group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next - 1]?.focus();
              }}
              className="tap-quiet grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              style={{ width: target, height: target }}
            >
              <span
                aria-hidden="true"
                className={cx('orb block', !lit && 'orb-idle')}
                style={
                  {
                    width: diameter,
                    height: diameter,
                    '--orb-colour': colour(step),
                    backgroundColor: lit ? colour(step) : undefined,
                    opacity: lit ? (chosen ? 1 : 0.55) : undefined,
                    transform: chosen ? 'scale(1.14)' : 'scale(1)',
                    boxShadow: chosen ? `0 0 0 6px color-mix(in oklab, ${colour(step)} 18%, transparent), 0 10px 28px -6px ${colour(step)}` : undefined,
                  } as React.CSSProperties
                }
              />
            </button>
          );
        })}
      </div>

      {showWord && (
        <p aria-hidden="true" className={cx('mt-3 text-center font-semibold text-ink', size === 'lg' ? 'h-8 text-[1.375rem]' : 'h-7 text-section')}>
          {value !== null ? labels[value] : ''}
        </p>
      )}
    </div>
  );
}
