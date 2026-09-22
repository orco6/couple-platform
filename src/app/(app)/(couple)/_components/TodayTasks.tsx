'use client';

import { AnimatePresence, LayoutGroup } from 'motion/react';
import { Plus } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, apiRequest } from '@/core/http/client';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { Button } from '@/core/ui/components/Button';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { useToast } from '@/core/ui/components/Toast';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { ArchiveDialog, TaskFormSheet } from './TaskFormSheet';
import { TaskCard } from './TaskCard';
import type { RatingValue } from './Stars';

/**
 * TODAY'S LIST — every card on the screen, and the writes behind them.
 *
 * ONE component owns all of today's tasks, and the three sections are derived
 * here rather than on the server. That is the whole point: a card MOVES between
 * the sections every time it is tapped (open → waiting for my rating → closed
 * today), and optimistic state that lived per-section outlived the card it
 * belonged to. Ticking a task off in one list and reopening it in another
 * brought it back wearing the patch that said "completed", and for a frame it
 * existed in two lists at once. Deriving the sections from patched views makes
 * both impossible: one task, one view, one place on the screen.
 *
 * Completion and rating are both optimistic. The mark has to fill under the
 * finger and the star has to land under the thumb — on a phone at night the
 * round trip is the difference between "done" and "did that register". If the
 * write fails the card snaps back and says so, which is the only honest way to
 * be optimistic.
 *
 * The writes use `apiRequest` directly rather than `useSubmit`. `useSubmit`
 * holds ONE in-flight guard for the whole hook and returns null both for
 * "refused" and for "ignored, something else is in flight" — right for a form,
 * wrong for a list. Here every card gets its own queue instead: taps on two
 * cards run in parallel, taps on the SAME card run in order, and each request
 * is addressed with the version the previous answer came back with. Ticking a
 * card and immediately un-ticking it is a thing people do at 23:40; neither tap
 * may be dropped, and neither may be reported as a failure.
 */

/** The server's own sentence when it has one; a generic line otherwise. */
function messageFor(error: unknown): string {
  return error instanceof ApiError && error.userMessage ? error.userMessage : copy.errors.taskChangedMeanwhile;
}

export function TodayTasks({
  tasks,
  me,
  partner,
  today,
  children,
}: {
  tasks: TaskView[];
  me: PartnerRef;
  partner: PartnerRef | null;
  today: CalendarDate;
  /** The day card, rendered on the server and slotted under the header. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();

  /** Cards whose state is ahead of the server, and the one just tapped. */
  const [optimistic, setOptimistic] = useState<Record<string, Partial<TaskView>>>({});
  const [justTapped, setJustTapped] = useState<string | null>(null);
  /** The newest answer the server has given for a card — above all its `version`. */
  const confirmed = useRef<Record<string, TaskView>>({});
  /** One promise chain per card, so a card's requests never overtake each other. */
  const chain = useRef<Record<string, Promise<void>>>({});

  const [editing, setEditing] = useState<TaskView | null>(null);
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState<TaskView | null>(null);

  /**
   * Render-phase adjustment, not an effect: forget a patch once the server has
   * caught up with it, or once the task has left the day altogether (archived,
   * or moved to another date).
   */
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
    setJustTapped(null);
    toast.show(message, 'error');
  }

  /**
   * The version to address a write with: whatever is newest between the props
   * we were rendered with and the last answer the server gave us.
   */
  function base(task: TaskView): TaskView {
    const remembered = confirmed.current[task.id];
    return remembered && remembered.version > task.version ? remembered : task;
  }

  /**
   * Runs `work` once everything already queued for this card has finished, and
   * rolls the card back if it refuses. Queueing rather than guarding is what
   * lets a fast second tap land: it waits for the first answer — and for the
   * version in it — instead of being dropped on the floor.
   */
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
        // Completing it puts the owner into "waiting for their rating", which
        // is the state change people actually look for.
        awaitingPartnerRating: next === 'COMPLETED' && current.rating === null && current.ownerId === me.id,
        permissions: {
          ...current.permissions,
          rate: next === 'COMPLETED' && current.ownerId !== me.id && current.rating === null,
        },
      },
    }));
    setJustTapped(task.id);

    enqueue(task.id, async () => {
      const from = base(task);
      // An earlier tap in this queue may already have put the card where this
      // one wanted it — two taps that cancel out are two taps, not an error.
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
      [task.id]: {
        ...previous[task.id],
        rating: { value, ratedByName: me.name },
        awaitingPartnerRating: false,
      },
    }));

    enqueue(task.id, async () => {
      await apiRequest('/api/task-ratings', { method: 'POST', body: { taskId: task.id, value } });
      // Nothing to announce: the stars are the confirmation. A toast here
      // would be the app congratulating itself.
      router.refresh();
    });
  }

  const views = tasks.map(view);
  // Somebody is waiting on the other end of these, and each costs one tap.
  const toRate = views.filter((task) => task.permissions.rate && task.rating === null);
  const open = views.filter((task) => task.state === 'OPEN');
  const closed = views.filter(
    (task) => task.state === 'COMPLETED' && !toRate.some((waiting) => waiting.id === task.id),
  );
  const allClosed = open.length === 0 && views.length > 0;

  const sheets = (
    <>
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
                // The next overlay opens after this one has finished closing;
                // two overlays animating together reads as a glitch.
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
    </>
  );

  function list(section: TaskView[]) {
    return (
      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {section.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              me={me}
              partner={partner}
              celebrate={justTapped === task.id}
              onToggle={toggle}
              onRate={rate}
              onOpen={setEditing}
            />
          ))}
        </AnimatePresence>
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title={copy.tasks.pageTitle}
        description={allClosed ? copy.tasks.allClosedWhy : copy.tasks.openCount(open.length)}
      />

      {children && <div className="mb-7">{children}</div>}

      {views.length === 0 ? (
        <>
          <EmptyState
            title={copy.tasks.emptyTitle}
            description={copy.tasks.emptyWhy}
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                {copy.tasks.addAction}
              </Button>
            }
          />
          {sheets}
        </>
      ) : (
        <LayoutGroup>
          {toRate.length > 0 && <Section title={copy.taskRating.sectionTitle}>{list(toRate)}</Section>}

          <Section title={allClosed ? copy.tasks.allClosed : undefined}>
            {open.length > 0 ? list(open) : null}
            <div className={open.length > 0 ? 'mt-4' : undefined}>
              <Button variant="secondary" onClick={() => setAdding(true)} className="w-full">
                <Plus aria-hidden="true" size={16} />
                {copy.tasks.addAction}
              </Button>
            </div>
          </Section>

          {closed.length > 0 && <Section title={copy.tasks.closedToday}>{list(closed)}</Section>}

          {sheets}
        </LayoutGroup>
      )}
    </>
  );
}
