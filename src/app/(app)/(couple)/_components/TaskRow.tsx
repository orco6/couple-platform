'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Clock, Image as ImageIcon, Pencil } from 'lucide-react';
import { useState } from 'react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import type { RatingValue } from './Slider';
import { SwipeRow } from './SwipeRow';

/**
 * ONE TASK — one line.
 *
 *   ○  לקנות חלב                                  ● נטיה
 *
 * The check, the sentence, and at the end ONE small thing: whose it is while
 * it is open (their light and their name — the initial alone was a riddle), or where it stands once it is
 * done — waiting for the other's rating, the rating itself, or an invitation
 * to rate when it is this person's turn. Everything a screen reader needs is
 * still said; almost nothing is printed.
 *
 * The row itself never moves. The one line that can come and go under the
 * title (waiting for a rating, or the rating, which its rater can tap to
 * change) opens and closes with a measured height animation, never a jump.
 * Completing is a physical moment that stays inside the row: the ring presses
 * in, fills with the owner's light with a small overshoot, the tick draws
 * itself, the strike travels across the title, and a sweep of the owner's
 * light passes through the row once (keyed, so it plays on the change only,
 * never on load). The room's matching light brightens for a beat (TodayTasks).
 */
export function TaskRow({
  task,
  me,
  partner,
  onToggle,
  onOpen,
  onRate,
  fresh = false,
  swiped = false,
  onSwipe,
  onDelete,
  removing = false,
}: {
  task: TaskView;
  me: PartnerRef;
  partner: PartnerRef | null;
  onToggle: (task: TaskView) => void;
  onOpen: (task: TaskView) => void;
  onRate: (task: TaskView) => void;
  /** Arrived while the screen was open: it enters, once. */
  fresh?: boolean;
  /** Swiped open, showing its delete action (one row at a time). */
  swiped?: boolean;
  onSwipe: (open: boolean) => void;
  onDelete: (task: TaskView) => void;
  /** Being deleted: it folds away. */
  removing?: boolean;
}) {
  const done = task.state === 'COMPLETED';
  const ownerIsMe = task.ownerId === me.id;
  const owner = ownerIsMe ? me : (partner ?? me);
  const side = owner.side;
  const ownerSays = ownerIsMe ? copy.tasks.ownerMe : copy.tasks.ownerPartner(owner.name);
  const reduced = useReducedMotion();

  // Where a finished task stands, as the second line: waiting for the other's
  // rating (said in words — the hourglass alone was a riddle), or the rating.
  const firstName = (name: string) => name.split(' ')[0] ?? name;
  const ratedLine = task.rating
    ? task.rating.ratedByName === me.name
      ? copy.taskRating.myRatedLine(copy.taskRating.scale[task.rating.value as RatingValue])
      : copy.taskRating.ratedLine(task.rating.ratedByName, copy.taskRating.scale[task.rating.value as RatingValue])
    : '';
  const status = !done ? null : task.rating ? (
    // The rater can change it right here — the badge says so with a pencil.
    task.permissions.rate ? (
      <button
        type="button"
        onClick={() => onRate(task)}
        className="tap-quiet press inline-flex min-h-10 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <RatingBadge value={task.rating.value} editable />
        <span className="sr-only">{ratedLine}</span>
        <span className="sr-only">. {copy.taskRating.change}</span>
      </button>
    ) : (
      <span className="inline-flex min-h-8 items-center">
        <RatingBadge value={task.rating.value} />
        <span className="sr-only">{ratedLine}</span>
      </span>
    )
  ) : task.awaitingPartnerRating ? (
    <span className="flex min-h-8 items-center gap-1.5 text-meta text-ink-muted">
      <span aria-hidden="true" className="waiting-dot" />
      {partner ? copy.taskRating.awaiting(firstName(partner.name)) : copy.taskRating.awaitingShort}
    </span>
  ) : null;

  // The sweep plays when THIS screen completes the task, not when it loads done.
  const [was, setWas] = useState(done);
  const [sweep, setSweep] = useState(0);
  if (was !== done) {
    setWas(done);
    if (done) setSweep((count) => count + 1);
  }

  return (
    <SwipeRow
      open={swiped}
      onOpenChange={onSwipe}
      onDelete={() => onDelete(task)}
      removing={removing}
      deleteLabel={copy.tasks.deleteShort}
      className={cx('task-row', fresh && 'row-enter')}
    >
      <div className="flex min-h-[3.75rem] items-center gap-1 ps-1.5 pe-2.5">
        {sweep > 0 && <span key={sweep} aria-hidden="true" className={cx('row-sweep', side === 'a' ? 'row-sweep--a' : 'row-sweep--b')} />}
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-pressed={done}
          aria-label={done ? copy.tasks.reopenAction : copy.tasks.completeAction}
          className="check-button tap-quiet grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus"
        >
          <span aria-hidden="true" data-done={done} className={cx('check', side === 'a' ? 'check--a' : 'check--b')}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none">
              <path
                d="M5.5 12.5l4.2 4.2 8.8-9.4"
                pathLength={1}
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="check-tick text-on-partner"
              />
            </svg>
          </span>
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
          <button
            type="button"
            onClick={() => onOpen(task)}
            className="tap-quiet flex min-h-11 flex-col items-start justify-center text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span
              className={cx(
                'text-[1rem] leading-snug font-medium text-pretty [overflow-wrap:anywhere] min-[360px]:text-[1.0625rem]',
                done ? 'text-ink-subtle' : 'text-ink',
              )}
            >
              {/* Inline, so the line crosses every line of a long title. */}
              <span data-done={done} className="title-strike">
                {task.title}
              </span>
            </span>
            {/* The details, always in the same place under the title: until
                when, and how many photos. */}
            {(task.dueTime || task.photos.length > 0) && (
              <span
                className={cx(
                  'mt-1 flex items-center gap-2.5 text-meta text-ink-muted tabular-nums transition-opacity duration-300',
                  done && 'opacity-70',
                )}
              >
                {task.dueTime && (
                  <span className="flex items-center gap-1">
                    <Clock aria-hidden="true" size={13} />
                    {copy.tasks.untilTime(task.dueTime)}
                  </span>
                )}
                {task.photos.length > 0 && (
                  <span className="flex items-center gap-1">
                    <ImageIcon aria-hidden="true" size={13} />
                    <span aria-hidden="true">{task.photos.length}</span>
                    <span className="sr-only">{copy.tasks.photoCount(task.photos.length)}</span>
                  </span>
                )}
              </span>
            )}
            <span className="sr-only">, {ownerSays}</span>
          </button>
          {/* Where a finished task stands. It opens and closes with a real height
            animation (Motion measures it), so ticking a task never makes the
            row jump taller or snap shorter. */}
          <AnimatePresence initial={false}>
            {status && (
              <motion.div
                key="status"
                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-0.5">{status}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* One fixed width, whatever it holds, so completing never reflows the title. */}
        <span className="flex w-12 shrink-0 items-center justify-end">
          {done && task.permissions.rate && !task.rating ? (
            <button
              type="button"
              onClick={() => onRate(task)}
              aria-label={`${copy.taskRating.rateShort} — ${copy.taskRating.prompt}`}
              className={cx(
                'tap-quiet press inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-chip px-2 text-meta font-semibold whitespace-nowrap',
                'shadow-[inset_0_0_0_1.5px_currentColor] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                owner.side === 'a' ? 'text-partner-a' : 'text-partner-b',
              )}
            >
              {copy.taskRating.rateShort}
            </button>
          ) : (
            <span
              aria-hidden="true"
              className={cx(
                'flex min-w-0 max-w-full items-center gap-1.5 text-meta font-semibold',
                done ? 'text-ink-muted' : owner.side === 'a' ? 'text-partner-a' : 'text-partner-b',
              )}
            >
              {/* Finished: the name goes quiet in colour, never in contrast; only the dot fades. */}
              <span className={cx(owner.side === 'a' ? 'light-a' : 'light-b', 'size-3 shrink-0', done && 'opacity-50')} />
              <span className="truncate">{owner.id === me.id ? copy.common.me : owner.name.split(' ')[0]}</span>
            </span>
          )}
        </span>
      </div>
    </SwipeRow>
  );
}

/**
 * A rating, as a badge that reads at a glance: five short segments filled up
 * to the value, in that value's own colour (dusk blue for 1 … warm orange for
 * 5), and the word. Two ratings never look alike, and the badge is not a
 * button — changing a rating is a clear action inside the task.
 */
export function RatingBadge({ value, who, editable = false }: { value: number; who?: string; editable?: boolean }) {
  const word = copy.taskRating.scale[value as RatingValue];
  return (
    <span className="rating-badge" style={{ '--tone': `var(--orb-day-${value})` } as React.CSSProperties}>
      {who && <span className="rating-badge-who">{who}</span>}
      <span aria-hidden="true" className="rating-badge-bars" dir="ltr">
        {[1, 2, 3, 4, 5].map((step) => (
          <i key={step} data-on={step <= value} />
        ))}
      </span>
      <span className="rating-badge-word">{word}</span>
      {editable && <Pencil aria-hidden="true" size={11} strokeWidth={2.4} className="text-ink-muted" />}
    </span>
  );
}
