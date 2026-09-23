'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { cx } from '@/core/ui/cx';

import { spring, tick } from './motion';

/**
 * THE SLIDER — how every 1–5 in the product is given (fourth edition).
 *
 * The third edition's five separate circles left people asking "what does this
 * one mean?" and closed before they had finished deciding. This is one wide
 * track you drag along, modelled on the principle of iOS Health's State of
 * Mind logger: the answer is a place on a continuum, the light follows the
 * finger, and the word for where you are changes as you move.
 *
 *   • The track is the whole scale, drawn as its own colours (dusk → morning),
 *     with five quiet stops. Its two ends are named; the middle is not.
 *   • The light follows the finger 1:1 (no easing while held), snaps to the
 *     nearest of five stops on release with a short spring, and its colour is
 *     a continuous blend of the five.
 *   • The word above it is the value under the finger, live.
 *   • NOTHING IS COMMITTED WHILE A FINGER IS DOWN. `onRelease` fires on
 *     pointerup only; a cancelled touch (the page took it as a scroll, the
 *     system took it) puts the value back where it was.
 *   • Tap works as well as drag: a touch lands the light where it touched.
 *   • `progress` (0..1, continuous) lets the screen around it follow the
 *     finger too — the daily question re-lights the room with it.
 *
 * Drawn left to right in both languages — 1 (לא יצא) at the left, 5 (מושלם)
 * at the right — which is how the owner reads a scale. Underneath is a real <input type="range">, so the
 * keyboard (arrows, Home/End) and VoiceOver (swipe up/down) work natively;
 * Enter confirms, and a keyboard change also confirms on its own after a
 * pause, because a screen-reader user has no "release".
 */
export type RatingValue = 1 | 2 | 3 | 4 | 5;
const STEPS: RatingValue[] = [1, 2, 3, 4, 5];

function useWeight(x: MotionValue<number>, step: RatingValue) {
  return useTransform(x, (fraction) => Math.max(0, 1 - Math.abs(fraction * 4 - (step - 1))));
}

const toFraction = (value: RatingValue) => (value - 1) / 4;
const toValue = (fraction: number) => (Math.round(Math.min(1, Math.max(0, fraction)) * 4) + 1) as RatingValue;

export function Slider({
  value,
  onChange,
  onRelease,
  onGrab,
  labels,
  label,
  hint,
  size = 'md',
  progress: external,
  confirmOnIdle = false,
}: {
  value: RatingValue | null;
  /** Every time the value under the finger (or key) changes; null when a
   *  cancelled first touch takes the answer back to "nothing yet". */
  onChange: (value: RatingValue | null) => void;
  /** The finger lifted (or Enter): the one moment an answer is given. */
  onRelease?: (value: RatingValue) => void;
  /** A finger came down (anything pending on the last answer should wait). */
  onGrab?: () => void;
  labels: Record<RatingValue, string>;
  /** Accessible name. */
  label: string;
  /** Shown in the word's place before anything is chosen. */
  hint: string;
  size?: 'md' | 'lg';
  /** Continuous 0..1 position, for the screen around it. */
  progress?: MotionValue<number>;
  /** Keyboard/VoiceOver changes confirm themselves after a pause. */
  confirmOnIdle?: boolean;
}) {
  const reduced = useReducedMotion();
  const own = useMotionValue(value === null ? 0.5 : toFraction(value));
  const x = external ?? own;
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(0);
  // A magnitude axis, the same in both languages: 1 at the left, 5 at the
  // right (the owner asked for מושלם on the right). Kept as a flag so the
  // geometry below reads the same either way.
  const rtl = false;
  const [held, setHeld] = useState(false);
  const [settled, setSettled] = useState(0);
  const drag = useRef<{ id: number; from: RatingValue | null; live: RatingValue | null } | null>(null);
  const idle = useRef<number | undefined>(undefined);
  const captionId = useId();

  const thumb = size === 'lg' ? 64 : 56;
  const rail = width - thumb;

  useLayoutEffect(() => {
    const node = track.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // A value set from outside (an existing answer) puts the light there.
  useEffect(() => {
    if (drag.current || value === null) return;
    x.set(toFraction(value));
  }, [value, x]);

  useEffect(() => () => window.clearTimeout(idle.current), []);

  const left = useTransform(x, (fraction) => (rtl ? 1 - fraction : fraction) * Math.max(0, rail));
  // Each colour's weight falls off linearly one stop away: a continuous blend.
  const layers = [useWeight(x, 1), useWeight(x, 2), useWeight(x, 3), useWeight(x, 4), useWeight(x, 5)];

  function fractionAt(clientX: number) {
    const rect = track.current!.getBoundingClientRect();
    const along = (clientX - rect.left - thumb / 2) / Math.max(1, rect.width - thumb);
    const clamped = Math.min(1, Math.max(0, along));
    return rtl ? 1 - clamped : clamped;
  }

  function follow(clientX: number) {
    const fraction = fractionAt(clientX);
    x.set(fraction);
    const next = toValue(fraction);
    if (drag.current && next !== drag.current.live) {
      drag.current.live = next;
      onChange(next);
      tick(6);
    }
  }

  function snap(to: RatingValue) {
    animate(x, toFraction(to), reduced ? { duration: 0 } : spring.snappy);
  }

  function confirm(to: RatingValue) {
    setSettled((count) => count + 1);
    onRelease?.(to);
  }

  return (
    <div className="select-none">
      {/* The word for where the light is — live, in a slot that never moves. */}
      <p
        aria-hidden="true"
        className={cx(
          'text-center font-semibold transition-colors duration-200',
          size === 'lg' ? 'h-10 text-[1.75rem]' : 'h-9 text-[1.5rem]',
          value === null ? 'text-ink-subtle' : 'text-ink',
        )}
      >
        <span key={value === null ? 'hint' : `${value}-${settled}`} className={cx('inline-block', value !== null && 'word-in')}>
          {value === null ? hint : labels[value]}
        </span>
      </p>

      <div
        ref={track}
        dir="ltr"
        className="relative mt-3 cursor-grab touch-pan-y active:cursor-grabbing"
        style={{ height: thumb + 24 }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !track.current) return;
          window.clearTimeout(idle.current);
          onGrab?.();
          track.current.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, from: value, live: null };
          setHeld(true);
          input.current?.focus({ preventScroll: true });
          follow(event.clientX);
        }}
        onPointerMove={(event) => {
          if (drag.current?.id === event.pointerId) follow(event.clientX);
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          if (current?.id !== event.pointerId) return;
          drag.current = null;
          setHeld(false);
          const landed = current.live ?? toValue(x.get());
          if (landed !== value) onChange(landed);
          snap(landed);
          confirm(landed);
        }}
        onPointerCancel={(event) => {
          // The browser took the touch (a vertical scroll, a system gesture):
          // nothing was given, so everything goes back to how it was.
          const current = drag.current;
          if (current?.id !== event.pointerId) return;
          drag.current = null;
          setHeld(false);
          if (current.from === null) {
            animate(x, 0.5, reduced ? { duration: 0 } : spring.settle);
          } else {
            snap(current.from);
          }
          if (current.live !== null && current.live !== current.from) onChange(current.from);
        }}
      >
        {/* The scale itself: its colours, and five stops. */}
        <span
          aria-hidden="true"
          className="slider-rail absolute top-1/2 -translate-y-1/2 rounded-full"
          style={{ left: thumb / 2 - 6, right: thumb / 2 - 6, height: 12, '--rail-dir': rtl ? 'to left' : 'to right' } as React.CSSProperties}
        />
        {STEPS.map((step) => {
          const at = rtl ? 1 - toFraction(step) : toFraction(step);
          return (
            <span
              key={step}
              aria-hidden="true"
              className="slider-stop absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: thumb / 2 + at * Math.max(0, rail) }}
            />
          );
        })}

        {/* The light. */}
        <motion.span
          aria-hidden="true"
          className="absolute top-3 left-0 block"
          style={{ x: left, width: thumb, height: thumb }}
        >
          <span
            className={cx('slider-thumb block size-full rounded-full', held && 'is-held', value === null && 'is-idle')}
            data-settled={settled}
          >
            {STEPS.map((step, index) => (
              <motion.span
                key={step}
                className={`slider-thumb-tone slider-tone-${step}`}
                style={{ opacity: value === null && !held ? 0 : layers[index] }}
              />
            ))}
          </span>
        </motion.span>

        <input
          ref={input}
          type="range"
          min={1}
          max={5}
          step={1}
          value={value ?? 3}
          aria-label={label}
          aria-describedby={captionId}
          aria-valuetext={value === null ? hint : `${value} — ${labels[value]}`}
          onChange={(event) => {
            const next = Number(event.target.value) as RatingValue;
            if (drag.current) return;
            onChange(next);
            snap(next);
            if (confirmOnIdle && onRelease) {
              window.clearTimeout(idle.current);
              idle.current = window.setTimeout(() => confirm(next), 1500);
            }
          }}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && value !== null) {
              event.preventDefault();
              window.clearTimeout(idle.current);
              confirm(value);
            }
          }}
          className="slider-input"
        />
      </div>

      {/* The two ends, named once. */}
      <p id={captionId} dir="ltr" className="mt-1 flex justify-between px-1 text-meta text-ink-muted">
        <span>{labels[1]}</span>
        <span className="sr-only">—</span>
        <span>{labels[5]}</span>
      </p>
    </div>
  );
}
