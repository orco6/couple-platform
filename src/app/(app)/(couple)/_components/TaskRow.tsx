'use client';

import { Hourglass } from 'lucide-react';
import { useState } from 'react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import type { RatingValue } from './Slider';

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
 * Nothing in this row changes its height, and the row itself never moves.
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
}: {
  task: TaskView;
  me: PartnerRef;
  partner: PartnerRef | null;
  onToggle: (task: TaskView) => void;
  onOpen: (task: TaskView) => void;
  onRate: (task: TaskView) => void;
  /** Arrived while the screen was open: it enters, once. */
  fresh?: boolean;
}) {
  const done = task.state === 'COMPLETED';
  const ownerIsMe = task.ownerId === me.id;
  const owner = ownerIsMe ? me : (partner ?? me);
  const side = owner.side;
  const ownerSays = ownerIsMe ? copy.tasks.ownerMe : copy.tasks.ownerPartner(owner.name);

  // The sweep plays when THIS screen completes the task, not when it loads done.
  const [was, setWas] = useState(done);
  const [sweep, setSweep] = useState(0);
  if (was !== done) {
    setWas(done);
    if (done) setSweep((count) => count + 1);
  }

  return (
    <li className={cx('task-row relative flex min-h-[3.75rem] items-center gap-1 overflow-hidden ps-1.5 pe-2.5', fresh && 'row-enter')}>
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
            <path d="M5.5 12.5l4.2 4.2 8.8-9.4" pathLength={1} stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="check-tick text-on-partner" />
          </svg>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="tap-quiet flex min-w-0 flex-1 flex-col items-start justify-center py-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span
          data-done={done}
          className={cx(
            'strike text-[1rem] leading-snug font-medium text-pretty [overflow-wrap:anywhere] min-[360px]:text-[1.0625rem]',
            done ? 'text-ink-subtle' : 'text-ink',
          )}
        >
          {task.title}
        </span>
        {/* The time sits under the title (as in Reminders), so every title has
            the full width, and it stays when the task is done — if it left,
            the row would change height under the finger. */}
        {task.dueTime && (
          <span dir="ltr" className={cx('mt-0.5 text-meta tabular-nums text-ink-subtle transition-opacity duration-300', done && 'opacity-50')}>
            {task.dueTime}
          </span>
        )}
        <span className="sr-only">, {ownerSays}</span>
      </button>

      {/* One fixed width, whatever it holds (a name, the invitation, the word,
          the hourglass), so completing never reflows the title. */}
      <span className="flex w-12 shrink-0 justify-end">
        <End task={task} me={me} partner={partner} owner={owner} done={done} onRate={onRate} />
      </span>
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
        aria-label={`${copy.taskRating.rateShort} — ${copy.taskRating.prompt}`}
        className={cx(
          'tap-quiet press inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-chip px-2 text-meta font-semibold whitespace-nowrap',
          'shadow-[inset_0_0_0_1.5px_currentColor] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          owner.side === 'a' ? 'text-partner-a' : 'text-partner-b',
        )}
      >
        {copy.taskRating.rateShort}
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

  // Open (or done with nothing to say): whose it is — their light and name.
  return (
    <span aria-hidden="true" className={cx('flex min-w-0 max-w-full items-center gap-1.5 text-meta font-semibold', owner.side === 'a' ? 'text-partner-a' : 'text-partner-b', done && 'opacity-50')}>
      <span className={cx(light, 'size-3 shrink-0')} />
      <span className="truncate">{owner.id === me.id ? copy.common.me : owner.name.split(' ')[0]}</span>
    </span>
  );
}
