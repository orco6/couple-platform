'use client';

import { useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { Moods } from './Moods';
import { Sheet } from './Sheet';
import { Slider, type RatingValue } from './Slider';

/** Release → the light settles (~250ms) → the word is read → the sheet leaves. */
const CONFIRM_AFTER = 750;

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
  const progress = useMotionValue(0.5);
  const leaving = useRef<number | undefined>(undefined);
  // Focus lands on the question, not the slider: a focus ring round the light
  // on open is noise to a finger; the keyboard is one Tab from the slider.
  const question = useRef<HTMLParagraphElement>(null);

  if ((task?.id ?? null) !== forTask) {
    setForTask(task?.id ?? null);
    setChosen((task?.rating?.value as RatingValue | undefined) ?? null);
  }

  useEffect(() => () => window.clearTimeout(leaving.current), []);

  return (
    <Sheet
      open={task !== null}
      onClose={() => {
        window.clearTimeout(leaving.current);
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
              onGrab={() => window.clearTimeout(leaving.current)}
              onChange={(next) => {
                // A new touch while the sheet was about to leave: stay.
                window.clearTimeout(leaving.current);
                setChosen(next);
              }}
              onRelease={(value) => {
                window.clearTimeout(leaving.current);
                leaving.current = window.setTimeout(() => {
                  onRate(task, value);
                  onClose();
                }, CONFIRM_AFTER);
              }}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}
