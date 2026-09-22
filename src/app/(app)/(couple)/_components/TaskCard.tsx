'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Clock, Hourglass, Star } from 'lucide-react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { PartnerMark } from './PartnerMark';
import { Stars, type RatingValue } from './Stars';

/**
 * A TASK, AND THE THREE THINGS THAT CAN HAPPEN TO IT.
 *
 * The card carries one row of content and, when it is this person's turn, one
 * action underneath it. The three states in order of the product's flow:
 *
 *   open            → the mark is an empty ring; tapping it completes the task
 *   done, unrated   → the owner sees "waiting for <name>"; the OTHER partner
 *                     sees five stars and can finish it in one tap
 *   done, rated     → the stars stay, small and quiet, with who gave them
 *
 * COMPLETION is built as a sequence, because the difference between "the
 * checkbox is ticked" and "I just finished that" is entirely in the timing:
 * the gradient fills from the centre on a spring, the check draws along its own
 * path, the title's line-through sweeps in from the inline start, and four
 * sparks leave the mark and are gone inside 600ms.
 *
 * RATING is deliberately not a sheet. Five stars inline, one tap, saved — a
 * sheet would add two taps and a transition to a three-second decision, and
 * this is the interaction the product is judged on.
 */

/** Uneven angles: a clock face reads mechanical. */
const SPARKS = [-58, -8, 44, 128];

export function TaskCard({
  task,
  me,
  partner,
  celebrate,
  onToggle,
  onRate,
  onOpen,
}: {
  task: TaskView;
  me: PartnerRef;
  partner: PartnerRef | null;
  /** True when this is the card the person just tapped — see the sparks. */
  celebrate: boolean;
  onToggle: (task: TaskView) => void;
  onRate: (task: TaskView, value: RatingValue) => void;
  onOpen: (task: TaskView) => void;
}) {
  const reduced = useReducedMotion();
  const done = task.state === 'COMPLETED';
  const ownerIsMe = task.ownerId === me.id;
  const ownerRef = ownerIsMe ? me : (partner ?? me);
  const sparking = done && celebrate && !reduced;

  return (
    <motion.li
      layout={!reduced}
      transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.9 }}
      className={cx('card overflow-hidden p-3.5', done && 'opacity-95')}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-pressed={done}
          aria-label={done ? copy.tasks.reopenAction : copy.tasks.completeAction}
          className="tap-quiet grid size-11 shrink-0 place-items-center rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <CompletionMark done={done} sparking={sparking} />
        </button>

        <button
          type="button"
          onClick={() => onOpen(task)}
          className="tap-quiet flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-control py-0.5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span
            data-done={done}
            className={cx('strike text-row leading-snug font-medium', done ? 'text-ink-subtle' : 'text-ink')}
          >
            {task.title}
          </span>

          {task.note && !done && <span className="text-body text-ink-subtle">{task.note}</span>}

          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <PartnerMark partner={ownerRef} size={18} />
              <span className="text-meta text-ink-subtle">
                {ownerIsMe ? copy.tasks.ownerMe : copy.tasks.ownerPartner(ownerRef.name)}
              </span>
            </span>

            {task.dueTime && !done && (
              <span className="flex items-center gap-1 text-meta text-accent-text">
                <Clock aria-hidden="true" size={13} />
                <span dir="ltr">{task.dueTime}</span>
              </span>
            )}
          </span>
        </button>

        {/* The settled rating: small, quiet, and on the end edge where the eye
            already goes for a status. */}
        {task.rating && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-chip bg-warning-tint px-2 py-1"
            title={copy.taskRating.ratedBy(task.rating.ratedByName, task.rating.value)}
          >
            <Star aria-hidden="true" size={13} className="fill-current text-warning-text" />
            <span className="text-meta font-semibold tabular-nums text-warning-text" dir="ltr">
              {task.rating.value}
            </span>
          </span>
        )}
      </div>

      {/* One action area, and only when it is this person's turn. */}
      <AnimatePresence initial={false}>
        {task.awaitingPartnerRating && (
          <Reveal key="waiting">
            <div className="mt-3 flex items-center gap-2 border-t border-rule-faint pt-3 text-meta text-ink-subtle">
              <Hourglass aria-hidden="true" size={14} />
              {partner ? copy.taskRating.awaiting(partner.name) : copy.taskRating.awaitingShort}
            </div>
          </Reveal>
        )}

        {task.permissions.rate && (
          <Reveal key="rate">
            <div className="mt-3 border-t border-rule-faint pt-3">
              <p className="mb-1 text-center text-meta text-ink-muted">
                {task.rating ? copy.taskRating.change : copy.taskRating.promptFor(ownerRef.name)}
              </p>
              <Stars
                legend={copy.taskRating.prompt}
                labels={copy.taskRating.scale}
                value={(task.rating?.value as RatingValue | undefined) ?? null}
                onChange={(value) => onRate(task, value)}
                size={40}
              />
            </div>
          </Reveal>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** Height-and-opacity entrance for the card's action area. */
function Reveal({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <div>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function CompletionMark({ done, sparking }: { done: boolean; sparking: boolean }) {
  const reduced = useReducedMotion();

  return (
    <span aria-hidden="true" className="relative grid size-7 place-items-center">
      {/* The resting ring stays under the fill, so the fill reads as landing
          inside it rather than replacing it. */}
      <span className="absolute inset-0 rounded-full border-2 border-rule-strong" />

      <motion.span
        className="surface-accent absolute inset-0 grid place-items-center rounded-full"
        initial={false}
        animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
        transition={
          reduced
            ? { duration: 0.12 }
            : done
              ? { type: 'spring', stiffness: 300, damping: 22, mass: 0.7 }
              : { duration: 0.16, ease: [0.4, 0, 1, 1] }
        }
      >
        <motion.span
          initial={false}
          animate={{ scale: done ? 1 : 0.4, opacity: done ? 1 : 0 }}
          transition={reduced ? { duration: 0.12 } : { delay: done ? 0.07 : 0, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <Check size={16} strokeWidth={3} className="text-on-accent" />
        </motion.span>
      </motion.span>

      {/* Four dots, one pass, gone inside 600ms. Confetti celebrates the app;
          this acknowledges the person. */}
      {sparking && (
        <span className="pointer-events-none absolute inset-0">
          {SPARKS.map((angleDeg, index) => {
            const angle = (angleDeg * Math.PI) / 180;
            return (
              <motion.span
                key={angleDeg}
                className="absolute left-1/2 top-1/2 size-1 rounded-full bg-accent"
                initial={{ x: Math.cos(angle) * 8, y: Math.sin(angle) * 8, opacity: 0, scale: 0.5 }}
                animate={{
                  x: Math.cos(angle) * 20,
                  y: Math.sin(angle) * 20,
                  opacity: [0, 0.9, 0],
                  scale: [0.5, 1, 0.4],
                }}
                transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1], delay: 0.12 + index * 0.02 }}
              />
            );
          })}
        </span>
      )}
    </span>
  );
}
