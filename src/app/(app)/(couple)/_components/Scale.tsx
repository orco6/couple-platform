'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useRef } from 'react';

import { cx } from '@/core/ui/cx';

import { reducedFade, spring, tick } from './motion';

/**
 * THE SCALE — how both ratings in the product are given.
 *
 * Five stops on one line, and the line fills up to the answer. It replaced a
 * row of stars, which on a phone read as reviewing a purchase: five separate
 * objects to be counted. A continuum reads as "how much", which is the actual
 * question, and a knob landing on it is a gesture rather than a grade.
 *
 * Still a real `radiogroup`: one tab stop (roving tabindex), arrows move the
 * choice and the focus together, Home/End jump, every stop is its own 44px+
 * target, and each radio's name carries the value and its word ("4 — טוב").
 * Drawn LTR in both languages: it is a magnitude axis, and ArrowRight means
 * "more" regardless of the page's direction.
 *
 * Motion is transform-only: the fill is a scaleX from the start edge and the
 * knob is a scale. The word underneath lives in a slot of fixed height, so
 * choosing never moves what is below it.
 */
const STEPS = [1, 2, 3, 4, 5] as const;
export type RatingValue = (typeof STEPS)[number];

export type ScaleTone = 'a' | 'b' | 'ink';

const FILL: Record<ScaleTone, string> = {
  a: 'bg-partner-a',
  b: 'bg-partner-b',
  ink: 'bg-accent',
};

const KNOB_CORE: Record<ScaleTone, string> = {
  a: 'bg-on-partner',
  b: 'bg-on-partner',
  ink: 'bg-on-accent',
};

function nextStep(key: string, from: RatingValue): RatingValue | null {
  if (key === 'Home') return 1;
  if (key === 'End') return 5;
  const delta =
    key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : 0;
  if (delta === 0) return null;
  return Math.min(5, Math.max(1, from + delta)) as RatingValue;
}

export function Scale({
  value,
  onChange,
  labels,
  legend,
  tone = 'ink',
  size = 'md',
  word = true,
  slot,
  disabled = false,
}: {
  value: RatingValue | null;
  onChange?: (value: RatingValue) => void;
  /** The word for each step — the thing people actually read. */
  labels: Record<RatingValue, string>;
  legend: string;
  tone?: ScaleTone;
  size?: 'md' | 'lg';
  /** Show the chosen word under the line. */
  word?: boolean;
  /** Replaces the word slot (e.g. a validation message), so nothing below moves. */
  slot?: React.ReactNode;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const readOnly = disabled || !onChange;
  const group = useRef<HTMLDivElement>(null);
  const stop = size === 'lg' ? 56 : 44;
  const knob = size === 'lg' ? 30 : 24;

  function choose(next: RatingValue) {
    if (readOnly || next === value) return;
    onChange?.(next);
    tick();
  }

  function focusStep(step: RatingValue) {
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[step - 1]?.focus();
  }

  const fill = value === null ? 0 : (value - 1) / 4;

  return (
    <div>
      <div
        ref={group}
        role="radiogroup"
        aria-label={legend}
        dir="ltr"
        className="relative flex items-center justify-between"
      >
        {/* The line, from the centre of the first stop to the centre of the last. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-rule"
          style={{ left: stop / 2, right: stop / 2 }}
        />
        <motion.span
          aria-hidden="true"
          className={cx('pointer-events-none absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full', FILL[tone])}
          style={{ left: stop / 2, right: stop / 2, originX: 0 }}
          initial={false}
          animate={{ scaleX: fill }}
          transition={reduced ? reducedFade : spring.settle}
        />

        {STEPS.map((step) => {
          const chosen = value === step;
          const reached = value !== null && step < value;
          return (
            <motion.button
              key={step}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={`${step} — ${labels[step]}`}
              tabIndex={chosen || (value === null && step === 1) ? 0 : -1}
              disabled={readOnly}
              onClick={() => choose(step)}
              onKeyDown={(event) => {
                if (readOnly) return;
                const next = nextStep(event.key, step);
                if (next === null) return;
                event.preventDefault();
                choose(next);
                focusStep(next);
              }}
              className={cx(
                'tap-quiet relative grid place-items-center rounded-full',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                readOnly && 'cursor-default',
              )}
              style={{ width: stop, height: stop }}
              whileTap={reduced || readOnly ? undefined : { scale: 0.88 }}
              transition={spring.snappy}
            >
              <motion.span
                aria-hidden="true"
                className={cx(
                  'grid place-items-center rounded-full transition-colors duration-150',
                  chosen || reached ? FILL[tone] : 'bg-surface shadow-[inset_0_0_0_2px_var(--color-rule-strong)]',
                )}
                style={{ width: knob, height: knob }}
                initial={false}
                animate={{ scale: chosen ? 1 : reached ? 0.42 : 0.52 }}
                transition={reduced ? reducedFade : spring.snappy}
              >
                <motion.span
                  className={cx('block rounded-full', KNOB_CORE[tone])}
                  style={{ width: knob * 0.3, height: knob * 0.3 }}
                  initial={false}
                  animate={{ opacity: chosen ? 1 : 0, scale: chosen ? 1 : 0.4 }}
                  transition={reduced ? reducedFade : spring.snappy}
                />
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      {word && (
        <div className={cx('relative', size === 'lg' ? 'mt-2 h-8' : 'mt-1 h-6')}>
          {slot ? (
            <div className="absolute inset-x-0 top-0 text-center">{slot}</div>
          ) : value !== null ? (
            <motion.span
              key={value}
              className={cx('absolute inset-x-0 top-0 text-center font-semibold text-ink', size === 'lg' ? 'text-section' : 'text-row')}
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {labels[value]}
            </motion.span>
          ) : (
            // Before anything is chosen: what the two ends mean, under the ends.
            <div dir="ltr" className="absolute inset-x-0 top-0 flex justify-between text-meta text-ink-subtle">
              <span className="text-start" style={{ width: stop * 1.6 }}>{labels[1]}</span>
              <span className="text-end" style={{ width: stop * 1.6 }}>{labels[5]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A small read-only meter for a settled value: five dots, the reached ones filled. */
export function ScaleDots({ value, tone = 'ink', className }: { value: number; tone?: ScaleTone; className?: string }) {
  return (
    <span aria-hidden="true" dir="ltr" className={cx('inline-flex items-center gap-[3px]', className)}>
      {STEPS.map((step) => (
        <span
          key={step}
          className={cx('block size-[5px] rounded-full', step <= value ? FILL[tone] : 'bg-rule')}
        />
      ))}
    </span>
  );
}
