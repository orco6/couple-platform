'use client';

import { useState } from 'react';

import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { Orbs, type RatingValue } from './Orbs';
import { Sheet } from './Sheet';

/**
 * RATING A TASK — a small moment over Today, not a control living in the list.
 *
 * The task, the question, five lights in the colour of the person who did it.
 * One tap answers; the word appears; the sheet leaves by itself. Changing a
 * rating is the same gesture (R-RATE-03: the author may change, never remove).
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
  if ((task?.id ?? null) !== forTask) {
    setForTask(task?.id ?? null);
    setChosen((task?.rating?.value as RatingValue | undefined) ?? null);
  }

  return (
    <Sheet open={task !== null} onClose={onClose} label={copy.taskRating.prompt} testId="rate-sheet">
      {task && owner && (
        <div className="pb-2 text-center">
          <p className="mx-auto max-w-72 truncate text-body text-ink-subtle">{task.title}</p>
          <p className="mt-1 text-title font-semibold text-ink">{copy.taskRating.prompt}</p>
          <div className="mt-6">
            <Orbs
              legend={copy.taskRating.prompt}
              labels={copy.taskRating.scale}
              value={chosen}
              tone={owner.side}
              onChange={(value) => {
                setChosen(value);
                onRate(task, value);
                window.setTimeout(onClose, 650);
              }}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}
