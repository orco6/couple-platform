'use client';

import { Hourglass } from 'lucide-react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import type { RatingValue } from './Orbs';

/**
 * ONE TASK — one line.
 *
 *   ○  לקנות חלב                                  (א)
 *
 * The check, the sentence, and at the end ONE small thing: whose it is while
 * it is open (their light, with their initial), or where it stands once it is
 * done — waiting for the other's rating, the rating itself, or an invitation
 * to rate when it is this person's turn. Everything a screen reader needs is
 * still said; almost nothing is printed.
 *
 * Nothing in this row changes its height, and the row itself never moves:
 * completing a task is a local change (the ring fills with the owner's light,
 * the title dims and is struck), not a re-shuffle of the list.
 */
export function TaskRow({
  task,
  me,
  partner,
  onToggle,
  onOpen,
  onRate,
}: {
  task: TaskView;
  me: PartnerRef;
  partner: PartnerRef | null;
  onToggle: (task: TaskView) => void;
  onOpen: (task: TaskView) => void;
  onRate: (task: TaskView) => void;
}) {
  const done = task.state === 'COMPLETED';
  const ownerIsMe = task.ownerId === me.id;
  const owner = ownerIsMe ? me : (partner ?? me);
  const side = owner.side;
  const ownerSays = ownerIsMe ? copy.tasks.ownerMe : copy.tasks.ownerPartner(owner.name);

  return (
    <li className="flex min-h-[3.75rem] items-center gap-2 ps-2 pe-4">
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-pressed={done}
        aria-label={done ? copy.tasks.reopenAction : copy.tasks.completeAction}
        className="tap-quiet press grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus"
      >
        <span aria-hidden="true" data-done={done} className={cx('check', side === 'a' ? 'check--a' : 'check--b')}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none">
            <path d="M5.5 12.5l4.2 4.2 8.8-9.4" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="text-on-partner" />
          </svg>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="tap-quiet flex min-w-0 flex-1 items-center py-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span
          data-done={done}
          className={cx(
            'strike text-[1.0625rem] leading-snug font-medium text-pretty [overflow-wrap:anywhere]',
            done ? 'text-ink-subtle' : 'text-ink',
          )}
        >
          {task.title}
        </span>
        <span className="sr-only">, {ownerSays}</span>
      </button>

      {!done && task.dueTime && (
        <span dir="ltr" className="shrink-0 text-meta tabular-nums text-ink-subtle">
          {task.dueTime}
        </span>
      )}

      <End task={task} me={me} partner={partner} owner={owner} done={done} onRate={onRate} />
    </li>
  );
}

function End({
  task,
  me,
  partner,
  owner,
  done,
  onRate,
}: {
  task: TaskView;
  me: PartnerRef;
  partner: PartnerRef | null;
  owner: PartnerRef;
  done: boolean;
  onRate: (task: TaskView) => void;
}) {
  const light = owner.side === 'a' ? 'light-a' : 'light-b';

  // My turn to rate: the one invitation a finished row can carry.
  if (done && task.permissions.rate && !task.rating) {
    return (
      <button
        type="button"
        onClick={() => onRate(task)}
        className={cx(
          'tap-quiet press inline-flex min-h-10 shrink-0 items-center rounded-chip px-3 text-meta font-semibold',
          'shadow-[inset_0_0_0_1.5px_currentColor] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          owner.side === 'a' ? 'text-partner-a' : 'text-partner-b',
        )}
      >
        {copy.taskRating.prompt}
      </button>
    );
  }

  // Rated: the word, quiet, in the colour of the person who did it. Tapping it
  // (for the one who gave it) changes it.
  if (done && task.rating) {
    const word = copy.taskRating.scale[task.rating.value as RatingValue];
    const byMe = task.rating.ratedByName === me.name;
    const label = byMe ? copy.taskRating.myRatedLine(word) : copy.taskRating.ratedLine(task.rating.ratedByName, word);
    const tone = owner.side === 'a' ? 'text-partner-a' : 'text-partner-b';
    return task.permissions.rate ? (
      <button
        type="button"
        onClick={() => onRate(task)}
        aria-label={`${label}. ${copy.taskRating.change}`}
        className={cx('tap-quiet min-h-10 min-w-10 shrink-0 px-1 text-meta font-semibold', tone)}
      >
        {word}
      </button>
    ) : (
      <span className={cx('shrink-0 text-meta font-semibold', tone)}>
        <span aria-hidden="true">{word}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  // Waiting for the other's rating: a small hourglass, said in full to AT.
  if (done && task.awaitingPartnerRating) {
    return (
      <span className="shrink-0 text-ink-subtle">
        <Hourglass aria-hidden="true" size={15} />
        <span className="sr-only">{partner ? copy.taskRating.awaiting(partner.name) : copy.taskRating.awaitingShort}</span>
      </span>
    );
  }

  // Open (or done with nothing to say): whose it is — their light.
  return (
    <span aria-hidden="true" className={cx(light, 'grid size-6 shrink-0 place-items-center text-[0.625rem] font-semibold text-on-partner', done && 'opacity-40')}>
      {owner.initial}
    </span>
  );
}
