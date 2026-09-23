'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, apiRequest } from '@/core/http/client';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { useToast } from '@/core/ui/components/Toast';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { spring } from './motion';
import type { RatingValue } from './Scale';
import { ArchiveDialog, TaskFormSheet, primeKeyboard } from './TaskFormSheet';
import { TaskRow } from './TaskRow';

/**
 * TODAY'S LIST — every task on the screen, and the writes behind them.
 *
 * ONE list, not three sections. The first edition moved a task between
 * "waiting for my rating", "open" and "closed today" on every tap: it
 * unmounted from one list and mounted in another, which on a phone is a row
 * that vanishes and reappears somewhere else. Now a row only ever moves
 * *within* this list, and only after a beat: a completed task stays where the
 * finger left it for 650ms (long enough to see the check land and the strike
 * draw), then glides down to the finished ones on a spring. Reopening glides it
 * back up the same way.
 *
 * Completion and rating are optimistic, per card, through one promise chain
 * per task — taps on two cards run in parallel, taps on the same card run in
 * order and each is addressed with the version the previous answer returned.
 * If the server refuses, the card snaps back and says so.
 */

/** How long a toggled row stays under the finger before it moves. */
const HOLD_MS = 650;

/**
 * Where a task belongs: waiting for MY rating first (someone is waiting on the
 * other end, and it costs one tap), then open, then finished.
 */
function rankOf(task: TaskView): number {
  if (task.state === 'COMPLETED' && task.permissions.rate && task.rating === null) return 0;
  return task.state === 'COMPLETED' ? 2 : 1;
}

function messageFor(error: unknown): string {
  return error instanceof ApiError && error.userMessage ? error.userMessage : copy.errors.taskChangedMeanwhile;
}

export function TodayTasks({
  tasks,
  me,
  partner,
  today,
}: {
  tasks: TaskView[];
  me: PartnerRef;
  partner: PartnerRef | null;
  today: CalendarDate;
}) {
  const router = useRouter();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [optimistic, setOptimistic] = useState<Record<string, Partial<TaskView>>>({});
  /** The row just completed here, for the one-time ring. */
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  /** Rows whose rating appeared because of a tap here, so it opens instead of appearing. */
  const [revealed, setRevealed] = useState<Record<string, true>>({});
  /** Rows held in their old place (their old rank) for a beat after a tap. */
  const [held, setHeld] = useState<Record<string, number>>({});
  const holdTimers = useRef<Record<string, number>>({});
  /** First-seen position of every task on this screen. */
  const [seen, setSeen] = useState<Record<string, number>>(() =>
    Object.fromEntries(tasks.map((task, index) => [task.id, index])),
  );

  const confirmed = useRef<Record<string, TaskView>>({});
  const chain = useRef<Record<string, Promise<void>>>({});

  const [editing, setEditing] = useState<TaskView | null>(null);
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState<TaskView | null>(null);

  useEffect(() => {
    const timers = holdTimers.current;
    return () => Object.values(timers).forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Forget a patch once the server has caught up, or the task left the day.
  const settled = Object.keys(optimistic).filter((id) => {
    const task = tasks.find((candidate) => candidate.id === id);
    const patched = optimistic[id]?.version;
    return !task || (patched !== undefined && task.version >= patched);
  });
  if (settled.length > 0) {
    setOptimistic((previous) => {
      const next = { ...previous };
      for (const id of settled) delete next[id];
      return next;
    });
  }

  function view(task: TaskView): TaskView {
    const patch = optimistic[task.id];
    return patch ? { ...task, ...patch } : task;
  }

  function rollback(id: string, message: string) {
    setOptimistic((previous) => {
      const { [id]: _dropped, ...rest } = previous;
      return rest;
    });
    setJustCompleted(null);
    toast.show(message, 'error');
  }

  function base(task: TaskView): TaskView {
    const remembered = confirmed.current[task.id];
    return remembered && remembered.version > task.version ? remembered : task;
  }

  function enqueue(id: string, work: () => Promise<void>) {
    const previous = chain.current[id] ?? Promise.resolve();
    const entry: Promise<void> = previous
      .then(work)
      .catch((error: unknown) => rollback(id, messageFor(error)))
      .finally(() => {
        if (chain.current[id] === entry) delete chain.current[id];
      });
    chain.current[id] = entry;
  }

  /**
   * Where a row sits right now. A task completed HERE that is now waiting for
   * my rating stays where it was (with its scale open under my thumb) instead
   * of jumping to the top; once rated, it settles with the finished ones.
   */
  function currentRank(task: TaskView): number {
    const heldRank = held[task.id];
    if (heldRank !== undefined) return heldRank;
    if (revealed[task.id] && task.state === 'COMPLETED' && task.rating === null) return 1;
    return rankOf(task);
  }

  /** Keep the row where it is for a beat, then let it find its place. */
  function hold(id: string, rank: number) {
    window.clearTimeout(holdTimers.current[id]);
    setHeld((previous) => (id in previous ? previous : { ...previous, [id]: rank }));
    holdTimers.current[id] = window.setTimeout(() => {
      setHeld((previous) => {
        const { [id]: _released, ...rest } = previous;
        return rest;
      });
    }, HOLD_MS);
  }

  function toggle(task: TaskView) {
    const current = view(task);
    const next = current.state === 'COMPLETED' ? 'OPEN' : 'COMPLETED';

    hold(task.id, currentRank(current));
    setOptimistic((previous) => ({
      ...previous,
      [task.id]: {
        state: next,
        awaitingPartnerRating: next === 'COMPLETED' && current.rating === null && current.ownerId === me.id,
        permissions: { ...current.permissions, rate: next === 'COMPLETED' && current.ownerId !== me.id },
      },
    }));
    setJustCompleted(next === 'COMPLETED' ? task.id : null);
    if (next === 'COMPLETED' && current.ownerId !== me.id) {
      setRevealed((previous) => ({ ...previous, [task.id]: true }));
    }

    enqueue(task.id, async () => {
      const from = base(task);
      if (from.state === next) return;

      const result = await apiRequest<TaskView>(`/api/tasks/${task.id}/transition`, {
        method: 'POST',
        body: { id: task.id, version: from.version, to: next },
      });

      confirmed.current[task.id] = result;
      setOptimistic((previous) => ({ ...previous, [task.id]: result }));
      router.refresh();
    });
  }

  function rate(task: TaskView, value: RatingValue) {
    hold(task.id, currentRank(view(task)));
    setOptimistic((previous) => ({
      ...previous,
      [task.id]: {
        ...previous[task.id],
        rating: { value, ratedByName: me.name },
        awaitingPartnerRating: false,
      },
    }));

    enqueue(task.id, async () => {
      await apiRequest('/api/task-ratings', { method: 'POST', body: { taskId: task.id, value } });
      router.refresh();
    });
  }

  const views = tasks.map(view);
  // Waiting for my rating, then open, then finished — otherwise in the order this screen first
  // saw them. The server re-sorts the list on every refresh (finished last),
  // so ordering by the server's index would move a row the moment its write
  // came back — before the hold below had let the check land. Remembered
  // order keeps a row where the finger left it; `held` keeps its group for
  // a beat; then it glides.
  const unseen = tasks.filter((task) => !(task.id in seen));
  if (unseen.length > 0) {
    // Render-phase adjustment: a task added since, placed after everything seen.
    setSeen((previous) => {
      const next = { ...previous };
      for (const task of unseen) next[task.id] = Object.keys(next).length;
      return next;
    });
  }
  const rank = currentRank;
  const ordered = [...views].sort(
    (a, b) => rank(a) - rank(b) || (seen[a.id] ?? 0) - (seen[b.id] ?? 0),
  );

  const doneCount = views.filter((task) => task.state === 'COMPLETED').length;

  function openComposer() {
    primeKeyboard();
    setAdding(true);
  }

  return (
    <section aria-labelledby="today-list-title">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 id="today-list-title" className="text-section font-semibold text-ink">
          {copy.today.listTitle}
        </h2>
        {views.length > 0 && (
          <span className="text-meta text-ink-subtle tabular-nums">
            {doneCount === views.length ? copy.today.allDone : copy.today.progress(doneCount, views.length)}
          </span>
        )}
      </div>

      <ul className="panel panel-rows overflow-hidden [overflow-anchor:none]">
        <li>
          <button
            type="button"
            onClick={openComposer}
            className="tap-quiet press-row flex min-h-14 w-full items-center gap-1 ps-1.5 pe-4 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <span className="grid size-12 shrink-0 place-items-center">
              <span className="grid size-[1.625rem] place-items-center rounded-full bg-accent text-on-accent">
                <Plus aria-hidden="true" size={16} strokeWidth={2.6} />
              </span>
            </span>
            <span className="text-[1rem] font-semibold text-ink">{copy.tasks.addAction}</span>
          </button>
        </li>

        <AnimatePresence initial={false}>
          {ordered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              me={me}
              partner={partner}
              celebrate={justCompleted === task.id}
              onToggle={toggle}
              onRate={rate}
              onOpen={setEditing}
            />
          ))}
        </AnimatePresence>

        {views.length === 0 && (
          <motion.li
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={spring.soft}
            className="px-5 py-6"
          >
            <p className="text-row text-ink-muted">{copy.today.emptyLine}</p>
            <p className="mt-0.5 text-body text-ink-subtle">{copy.tasks.emptyWhy}</p>
          </motion.li>
        )}
      </ul>

      <TaskFormSheet
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        task={editing}
        defaultDate={today}
        me={me}
        partner={partner}
        onArchive={
          editing
            ? (task) => {
                setEditing(null);
                setTimeout(() => setArchiving(task), 0);
              }
            : undefined
        }
      />

      <ArchiveDialog
        task={archiving}
        onClose={() => setArchiving(null)}
        onArchived={() => {
          setArchiving(null);
          router.refresh();
        }}
      />
    </section>
  );
}
