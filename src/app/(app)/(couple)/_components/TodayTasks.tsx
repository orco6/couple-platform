'use client';

import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, apiRequest } from '@/core/http/client';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { useToast } from '@/core/ui/components/Toast';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import type { RatingValue } from './Orbs';
import { RateSheet } from './RateSheet';
import { ArchiveDialog, TaskFormSheet, primeKeyboard } from './TaskFormSheet';
import { TaskRow } from './TaskRow';

/**
 * TODAY'S LIST — every task on the screen, and the writes behind them.
 *
 * Nothing moves. The order is fixed the first time this screen sees a task —
 * open ones first, finished ones after (the server's order at load) — and a
 * task completed or reopened here stays exactly where the finger left it. The
 * second edition glided rows to their new group; on a real phone that read as
 * the list re-arranging itself under the thumb. The list re-groups on the next
 * visit, quietly.
 *
 * Completion and rating are optimistic, through one promise chain per task —
 * taps on two tasks run in parallel, taps on the same task run in order, each
 * addressed with the version the previous answer returned. If the server
 * refuses, the task snaps back and says so.
 *
 * Rating is not in the list: it opens a small sheet from the row's
 * invitation (RateSheet).
 */

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

  const [optimistic, setOptimistic] = useState<Record<string, Partial<TaskView>>>({});
  const confirmed = useRef<Record<string, TaskView>>({});
  const chain = useRef<Record<string, Promise<void>>>({});

  const [editing, setEditing] = useState<TaskView | null>(null);
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState<TaskView | null>(null);
  const [rating, setRating] = useState<TaskView | null>(null);

  /** Where each task sits: its group and position when this screen first saw it. */
  const [seen, setSeen] = useState<Record<string, { group: number; index: number }>>(() =>
    Object.fromEntries(tasks.map((task, index) => [task.id, { group: task.state === 'COMPLETED' ? 1 : 0, index }])),
  );
  const unseen = tasks.filter((task) => !(task.id in seen));
  if (unseen.length > 0) {
    setSeen((previous) => {
      const next = { ...previous };
      for (const task of unseen) {
        next[task.id] = { group: task.state === 'COMPLETED' ? 1 : 0, index: Object.keys(next).length };
      }
      return next;
    });
  }

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

  function toggle(task: TaskView) {
    const current = view(task);
    const next = current.state === 'COMPLETED' ? 'OPEN' : 'COMPLETED';
    setOptimistic((previous) => ({
      ...previous,
      [task.id]: {
        state: next,
        awaitingPartnerRating: next === 'COMPLETED' && current.rating === null && current.ownerId === me.id,
        permissions: { ...current.permissions, rate: next === 'COMPLETED' && current.ownerId !== me.id },
      },
    }));

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
    setOptimistic((previous) => ({
      ...previous,
      [task.id]: { ...previous[task.id], rating: { value, ratedByName: me.name }, awaitingPartnerRating: false },
    }));
    enqueue(task.id, async () => {
      await apiRequest('/api/task-ratings', { method: 'POST', body: { taskId: task.id, value } });
      router.refresh();
    });
  }

  const ordered = tasks
    .map(view)
    .sort((a, b) => {
      const x = seen[a.id] ?? { group: 0, index: 0 };
      const y = seen[b.id] ?? { group: 0, index: 0 };
      return x.group - y.group || x.index - y.index;
    });

  const ownerOf = (task: TaskView | null) => (task ? (task.ownerId === me.id ? me : partner) : null);

  return (
    <>
      {ordered.length > 0 ? (
        <ul className="glass overflow-hidden [&>li+li]:border-t [&>li+li]:border-rule-faint" aria-label={copy.today.listTitle}>
          {ordered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              me={me}
              partner={partner}
              onToggle={toggle}
              onOpen={setEditing}
              onRate={setRating}
            />
          ))}
        </ul>
      ) : (
        <p className="px-2 pt-10 text-center text-title font-semibold text-ink-subtle">{copy.today.emptyTitle}</p>
      )}

      {/* The one action. Above the tab bar, where the thumb already is. */}
      <button
        type="button"
        onClick={() => {
          primeKeyboard();
          setAdding(true);
        }}
        aria-label={copy.tasks.addAction}
        className="tap-quiet press fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-20 mx-auto flex h-14 w-fit items-center gap-2 rounded-full bg-accent ps-5 pe-6 text-row font-semibold text-on-accent shadow-[var(--brand-shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:bottom-8"
      >
        <Plus aria-hidden="true" size={22} strokeWidth={2.4} />
        <span aria-hidden="true">{copy.tasks.addShort}</span>
      </button>

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
                setTimeout(() => setArchiving(task), 280);
              }
            : undefined
        }
      />

      <RateSheet task={rating} owner={ownerOf(rating)} onRate={rate} onClose={() => setRating(null)} />

      <ArchiveDialog
        task={archiving}
        onClose={() => setArchiving(null)}
        onArchived={() => {
          setArchiving(null);
          router.refresh();
        }}
      />
    </>
  );
}
