'use client';

import { AnimatePresence, LayoutGroup } from 'motion/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { EmptyState } from '@/core/ui/components/States';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { ArchiveDialog, TaskFormSheet } from './TaskFormSheet';
import { TaskCard } from './TaskCard';
import type { RatingValue } from './Stars';

/**
 * THE SHARED LIST.
 *
 * Completion and rating are both optimistic. The mark has to fill under the
 * finger and the star has to land under the thumb — on a phone at night the
 * round trip is the difference between "done" and "did that register". If the
 * write fails the card snaps back and says so, which is the only honest way to
 * be optimistic.
 */
export function TaskList({
  tasks,
  me,
  partner,
  today,
  showAdd = true,
}: {
  tasks: TaskView[];
  me: PartnerRef;
  partner: PartnerRef | null;
  today: CalendarDate;
  showAdd?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { submit } = useSubmit();

  /** Cards whose state is ahead of the server, and the one just tapped. */
  const [optimistic, setOptimistic] = useState<Record<string, Partial<TaskView>>>({});
  const [justTapped, setJustTapped] = useState<string | null>(null);

  const [editing, setEditing] = useState<TaskView | null>(null);
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState<TaskView | null>(null);

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

  async function toggle(task: TaskView) {
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

    const result = await submit(`/api/tasks/${task.id}/transition`, {
      method: 'POST',
      body: { id: task.id, version: task.version, to: next },
    });

    if (result === null) {
      rollback(task.id, copy.errors.taskChangedMeanwhile);
      return;
    }
    router.refresh();
  }

  async function rate(task: TaskView, value: RatingValue) {
    const current = view(task);
    setOptimistic((previous) => ({
      ...previous,
      [task.id]: {
        ...previous[task.id],
        rating: { value, ratedByName: me.name },
        awaitingPartnerRating: false,
      },
    }));

    const result = await submit('/api/task-ratings', { method: 'POST', body: { taskId: task.id, value } });
    if (result === null) {
      rollback(task.id, copy.errors.taskChangedMeanwhile);
      return;
    }
    // Nothing to announce: the stars are the confirmation. A toast here would
    // be the app congratulating itself.
    void current;
    router.refresh();
  }

  if (tasks.length === 0) {
    return (
      <>
        <EmptyState
          title={copy.tasks.emptyTitle}
          description={copy.tasks.emptyWhy}
          action={
            showAdd ? (
              <Button variant="primary" onClick={() => setAdding(true)}>
                {copy.tasks.addAction}
              </Button>
            ) : undefined
          }
        />
        <TaskFormSheet
          open={adding}
          onClose={() => setAdding(false)}
          defaultDate={today}
          me={me}
          partner={partner}
        />
      </>
    );
  }

  return (
    <>
      <LayoutGroup>
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={view(task)}
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
      </LayoutGroup>

      {showAdd && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setAdding(true)} className="w-full">
            <Plus aria-hidden="true" size={16} />
            {copy.tasks.addAction}
          </Button>
        </div>
      )}

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
}
