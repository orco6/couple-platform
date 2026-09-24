'use client';

import { Check } from 'lucide-react';
import { useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { Moods } from './Moods';
import { Sheet } from './Sheet';
import { Slider, type RatingValue } from './Slider';

/**
 * Release → a ring counts down around "save" while the word is read → the
 * sheet saves and leaves. Long enough to see and to change one's mind, short
 * enough never to feel like waiting.
 */
export const CONFIRM_AFTER = 2200;

/**
 * RATING A TASK — a small moment over Today.
 *
 * The task, the question, and the slider. Dragging lights the sheet in the
 * colour of the answer; the word says what that place means. Lifting the
 * finger is the answer — but the sheet waits until the light has settled and
 * the word has been seen before it saves and leaves, and a new touch in that
 * moment cancels the leaving. Changing a rating later is the same gesture
 * (R-RATE-03: the author may change, never remove).
 */
export function RateSheet({
  task,
  owner,
  onRate,
  onClose,
}: {
  task: TaskView | null;
  owner: PartnerRef | null;
  onRate: (task: TaskView, value: RatingValue) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<RatingValue | null>(null);
  const [forTask, setForTask] = useState<string | null>(null);
  /** Counting down to saving this value (a new key restarts the ring). */
  const [counting, setCounting] = useState<{
    value: RatingValue;
    key: number;
  } | null>(null);
  const progress = useMotionValue(0.5);
  const leaving = useRef<number | undefined>(undefined);
  // Focus lands on the question, not the slider: a focus ring round the light
  // on open is noise to a finger; the keyboard is one Tab from the slider.
  const question = useRef<HTMLParagraphElement>(null);

  if ((task?.id ?? null) !== forTask) {
    setForTask(task?.id ?? null);
    setChosen((task?.rating?.value as RatingValue | undefined) ?? null);
    setCounting(null);
  }

  function stopCounting() {
    window.clearTimeout(leaving.current);
    setCounting(null);
  }

  function commit(value: RatingValue) {
    window.clearTimeout(leaving.current);
    if (!task) return;
    onRate(task, value);
    onClose();
  }

  useEffect(() => () => window.clearTimeout(leaving.current), []);

  return (
    <Sheet
      open={task !== null}
      onClose={() => {
        stopCounting();
        onClose();
      }}
      label={copy.taskRating.prompt}
      testId="rate-sheet"
      initialFocus={question}
    >
      {task && owner && (
        <div className="relative pb-3 text-center">
          <Moods progress={progress} on={chosen !== null} contained />
          <p className="relative mx-auto max-w-72 truncate text-body text-ink-muted">{task.title}</p>
          <p ref={question} tabIndex={-1} className="relative mt-1 mb-5 text-title font-semibold text-ink outline-none">
            {copy.taskRating.prompt}
          </p>
          <div className="relative px-1">
            <Slider
              value={chosen}
              labels={copy.taskRating.scale}
              label={copy.taskRating.prompt}
              hint={copy.taskRating.hint}
              progress={progress}
              confirmOnIdle
              onGrab={stopCounting}
              onChange={(next) => {
                // A new touch while the sheet was about to leave: stay.
                stopCounting();
                setChosen(next);
              }}
              onRelease={(value) => {
                window.clearTimeout(leaving.current);
                setCounting({ value, key: Date.now() });
                leaving.current = window.setTimeout(() => commit(value), CONFIRM_AFTER);
              }}
            />
          </div>
          {/* The countdown: a ring fills around the check while the chosen word
              is read; tapping saves at once, touching the slider again stops it.
              Its place is always kept, so nothing moves when it appears. */}
          <div className="relative mt-4 flex h-14 items-center justify-center">
            <button
              type="button"
              onClick={() => counting && commit(counting.value)}
              tabIndex={counting ? 0 : -1}
              aria-hidden={counting ? undefined : true}
              data-on={counting !== null}
              className="rate-commit tap-quiet press inline-flex min-h-12 items-center gap-3 rounded-full ps-2 pe-5 text-body font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="relative grid size-10 place-items-center">
                <svg
                  key={counting?.key ?? 0}
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                  className="rate-ring absolute inset-0 size-10 -rotate-90"
                >
                  <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3" className="rate-ring-track" />
                  <circle
                    cx="20"
                    cy="20"
                    r="17"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    pathLength={1}
                    className="rate-ring-fill"
                    style={{ animationDuration: `${CONFIRM_AFTER}ms` }}
                  />
                </svg>
                <Check aria-hidden="true" size={18} strokeWidth={2.8} />
              </span>
              <span>{counting ? copy.taskRating.savingAs(copy.taskRating.scale[counting.value]) : copy.taskRating.saveNow}</span>
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
