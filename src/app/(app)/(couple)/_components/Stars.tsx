'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Star } from 'lucide-react';

import { cx } from '@/core/ui/cx';

/**
 * THE RATING CONTROL — five stars, one tap.
 *
 * Used for both ratings in the product, so the gesture is learned once. It is
 * a real `radiogroup`: arrow keys move between stars, the value is announced,
 * and every star is its own 44px target rather than a slider people have to
 * aim at.
 *
 * Filled stars carry the warm gradient and, once chosen, a soft glow — the
 * "modern visual response" the value change deserves. The chosen star also
 * springs once. Under reduced motion the fill still changes; nothing moves.
 */
const STEPS = [1, 2, 3, 4, 5] as const;
export type RatingValue = (typeof STEPS)[number];

export function Stars({
  value,
  onChange,
  labels,
  legend,
  size = 44,
  tone = 'warm',
  disabled = false,
}: {
  value: RatingValue | null;
  onChange?: (value: RatingValue) => void;
  /** Word per step, so the meaning is read rather than counted. */
  labels: Record<RatingValue, string>;
  legend: string;
  size?: number;
  tone?: 'warm' | 'accent';
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const readOnly = disabled || !onChange;

  function choose(next: RatingValue) {
    if (readOnly || next === value) return;
    onChange?.(next);
    // A tick per step. Ignored by iOS Safari, which is why it is never the
    // only feedback.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(8);
      } catch {
        // Vibration is a nicety; a blocked call is not an error.
      }
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={legend}
        dir="ltr"
        className="flex items-center justify-center gap-1"
      >
        {STEPS.map((step) => {
          const filled = value !== null && step <= value;
          const chosen = value === step;

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
                const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
                if (delta === 0) return;
                event.preventDefault();
                const next = Math.min(5, Math.max(1, (value ?? 0) + delta)) as RatingValue;
                choose(next);
              }}
              className={cx(
                'tap-quiet grid place-items-center rounded-control',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                readOnly && 'cursor-default',
              )}
              style={{ width: size, height: size }}
              whileTap={reduced || readOnly ? undefined : { scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.6 }}
            >
              <motion.span
                className={cx(
                  'grid place-items-center rounded-full transition-colors duration-200',
                  filled ? (tone === 'warm' ? 'surface-warm' : 'surface-accent') : 'bg-sunken ring-1 ring-rule',
                )}
                style={{ width: size * 0.78, height: size * 0.78 }}
                initial={false}
                animate={
                  reduced
                    ? { scale: 1 }
                    : { scale: chosen ? [1, 1.18, 1] : 1 }
                }
                transition={{ duration: chosen ? 0.34 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <Star
                  aria-hidden="true"
                  size={size * 0.44}
                  strokeWidth={filled ? 0 : 1.75}
                  className={filled ? 'fill-current text-on-accent' : 'text-ink-subtle/70'}
                />
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      {/* The word is what the person actually reads; the number is for
          assistive tech, which gets it from the radio's label. The slot keeps
          its height whether or not anything is chosen, so choosing never
          shifts what is underneath. */}
      <div className="mt-2 h-6 text-center">
        {value !== null && (
          <motion.span
            key={value}
            className="text-row font-semibold text-ink"
            initial={reduced ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {labels[value]}
          </motion.span>
        )}
      </div>
    </div>
  );
}
