'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Clock, Hourglass } from 'lucide-react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { reducedFade, spring } from './motion';
import { PartnerMark } from './PartnerMark';
import { Scale, ScaleDots, type RatingValue } from './Scale';

/**
 * ONE TASK, AS A ROW OF THE DAY'S LIST.
 *
 * A row, not a card: the day's tasks are one group of things, and the first
 * edition's card-per-task turned a short list into a wall of boxes.
 *
 * The row's height depends on its title and nothing else. The line under the
 * title always exists and is always one line; what it says changes with the
 * state (whose it is and by when → waiting for a rating → how it was rated),
 * so completing, rating and reopening never make the list jump.
 *
 * The one exception is the rating, and only when it is this person's turn: a
 * completed task their partner owns carries the scale inline, because rating
 * is one tap and a sheet would make it three. A row that loads in that state
 * is simply drawn with it; a row that ARRIVES in it because of a tap here
 * opens it with a height reveal (grid rows, 280ms) rather than a jump.
 *
 * COMPLETION: the ring fills with the colour of the person whose task it is,
 * the check draws along its path, a single ring of the same colour widens and
 * fades, and the title is struck from the inline start. Under reduced motion
 * the fill and the strike still happen; nothing travels.
 */
export function TaskRow({
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
  /** This is the row that was just completed here — the ring widens once. */
  celebrate: boolean;
  onToggle: (task: TaskView) => void;
  onRate: (task: TaskView, value: RatingValue) => void;
  onOpen: (task: TaskView) => void;
}) {
  const reduced = useReducedMotion();
  const done = task.state === 'COMPLETED';
  const ownerIsMe = task.ownerId === me.id;
  const owner = ownerIsMe ? me : (partner ?? me);
  const ownerTone = owner.side === 'a' ? 'a' : 'b';
  const canRate = task.permissions.rate;
  // Rated rows fold to one line; the scale comes back on "change", and stays
  // open after a rating given here so the knob is seen to land.
  const [changing, setChanging] = useState(false);
  const [ratedHere, setRatedHere] = useState(false);
  const showScale = canRate && (!task.rating || changing || ratedHere);

  return (
    <motion.li
      layout={reduced ? false : 'position'}
      transition={spring.settle}
      // A solid surface, so a row gliding past others covers them instead of overprinting their text.
      className={cx('relative', showScale && !task.rating ? (ownerTone === 'a' ? 'bg-partner-a-tint' : 'bg-partner-b-tint') : 'bg-surface')}
    >
      <div className="flex items-start gap-1 ps-1.5 pe-4">
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-pressed={done}
          aria-label={done ? copy.tasks.reopenAction : copy.tasks.completeAction}
          className="tap-quiet press grid size-12 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus"
        >
          <CheckMark done={done} tone={ownerTone} celebrate={celebrate && !reduced} />
        </button>

        <button
          type="button"
          onClick={() => onOpen(task)}
          className="tap-quiet flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-control py-3 text-start transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span
            data-done={done}
            className={cx(
              'strike text-[1rem] leading-snug font-medium text-pretty [overflow-wrap:anywhere]',
              done ? 'text-ink-subtle' : 'text-ink',
            )}
          >
            {task.title}
          </span>

          <span className="flex h-5 max-w-full items-center gap-1.5 overflow-hidden text-meta whitespace-nowrap text-ink-subtle">
            <PartnerMark partner={owner} size={14} />
            <span className="shrink-0">{ownerIsMe ? copy.tasks.ownerMe : copy.tasks.ownerPartner(owner.name)}</span>
            <MetaTail task={task} partner={partner} me={me} done={done} scaleOpen={showScale} />
          </span>
        </button>

        {canRate && task.rating && !showScale && (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="tap-quiet my-1.5 inline-flex min-h-11 shrink-0 items-center self-center rounded-chip px-2.5 text-meta font-medium text-accent-text hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
          >
            {copy.taskRating.changeShort}
          </button>
        )}
      </div>

      {/* The rating area exists on every task the other partner owns, open or
          folded. Opening and folding are one CSS transition on grid rows (so
          the row grows and shrinks, never snaps); a row that loads open is
          simply drawn open. Folded, it is inert and hidden from assistive tech. */}
      {!ownerIsMe && (
        <div
          className={cx(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            showScale ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          inert={!showScale}
          aria-hidden={!showScale || undefined}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="ps-4 pe-4 pb-2.5">
              <div className="flex h-5 items-center justify-between text-meta">
                <span className="font-medium text-ink-muted">
                  {task.rating
                    ? copy.taskRating.change
                    : task.completedById === owner.id
                      ? copy.taskRating.promptFor(owner.name)
                      : copy.taskRating.prompt}
                </span>
                <span className="font-semibold text-ink">
                  {task.rating ? copy.taskRating.scale[task.rating.value as RatingValue] : null}
                </span>
              </div>
              <div className="mx-auto max-w-72">
                <Scale
                  legend={copy.taskRating.prompt}
                  labels={copy.taskRating.scale}
                  value={(task.rating?.value as RatingValue | undefined) ?? null}
                  onChange={(value) => {
                    setRatedHere(true);
                    onRate(task, value);
                  }}
                  tone={ownerTone}
                  word={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.li>
  );
}

/** Everything after "whose": by when, or where the rating stands. One line, always. */
function MetaTail({
  task,
  partner,
  me,
  done,
  scaleOpen,
}: {
  task: TaskView;
  partner: PartnerRef | null;
  me: PartnerRef;
  done: boolean;
  /** The scale under the row already shows the value; do not say it twice. */
  scaleOpen: boolean;
}) {
  if (!done) {
    if (!task.dueTime) return null;
    return (
      <>
        <Dot />
        <Clock aria-hidden="true" size={12} className="shrink-0" />
        <span dir="ltr" className="tabular-nums">
          {task.dueTime}
        </span>
      </>
    );
  }

  if (task.awaitingPartnerRating) {
    return (
      <>
        <Dot />
        <Hourglass aria-hidden="true" size={12} className="shrink-0" />
        <span className="truncate">{partner ? copy.taskRating.awaiting(partner.name) : copy.taskRating.awaitingShort}</span>
      </>
    );
  }

  // Rated: who gave it, and the word.
  if (task.rating && !scaleOpen) {
    const word = copy.taskRating.scale[task.rating.value as RatingValue];
    const byMe = task.rating.ratedByName === me.name;
    return (
      <>
        <Dot />
        <ScaleDots value={task.rating.value} tone={task.ownerId === me.id ? me.side : (partner?.side ?? 'b')} />
        <span className="truncate" title={copy.taskRating.ratedBy(task.rating.ratedByName, task.rating.value)}>
          {byMe ? copy.taskRating.myRatedLine(word) : copy.taskRating.ratedLine(task.rating.ratedByName, word)}
        </span>
      </>
    );
  }

  return null;
}

function Dot() {
  return <span aria-hidden="true" className="shrink-0 text-rule-strong">·</span>;
}

function CheckMark({ done, tone, celebrate }: { done: boolean; tone: 'a' | 'b'; celebrate: boolean }) {
  const reduced = useReducedMotion();
  const fill = tone === 'a' ? 'bg-partner-a' : 'bg-partner-b';

  return (
    <span aria-hidden="true" className="relative grid size-[1.625rem] place-items-center">
      <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_var(--color-rule-strong)]" />

      {/* One ring of the owner's colour widens and fades — once. */}
      {celebrate && done && (
        <motion.span
          className={cx('absolute inset-0 rounded-full', fill)}
          initial={{ scale: 1, opacity: 0.35 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      )}

      <motion.span
        className={cx('absolute inset-0 grid place-items-center rounded-full', fill)}
        initial={false}
        animate={{ scale: done ? 1 : 0.3, opacity: done ? 1 : 0 }}
        transition={reduced ? reducedFade : done ? spring.snappy : { duration: 0.14, ease: [0.4, 0, 1, 1] }}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none">
          <motion.path
            d="M5.5 12.5l4.2 4.2 8.8-9.4"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-on-partner"
            initial={false}
            animate={{ pathLength: done ? 1 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: done ? 0.28 : 0.1, delay: done ? 0.08 : 0, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </motion.span>
    </span>
  );
}
