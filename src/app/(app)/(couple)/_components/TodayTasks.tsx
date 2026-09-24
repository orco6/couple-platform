'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, apiRequest } from '@/core/http/client';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { useToast } from '@/core/ui/components/Toast';
import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { ConfirmDialog } from '@/core/ui/components/Dialog';

import { Composer, primeKeyboard } from './Composer';
import { RateSheet } from './RateSheet';
import type { RatingValue } from './Slider';
import { PartnerAvatar } from './PartnerAvatar';
import { TaskRow } from './TaskRow';
import { TODAY_VIEW_COOKIE, type TodayView } from './today-view';

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

/** The room's light for this person brightens for a beat (styles.css, [data-pulse]). */
function pulse(side: 'a' | 'b') {
  const root = document.documentElement;
  root.dataset.pulse = side;
  window.clearTimeout(Number(root.dataset.pulseTimer));
  root.dataset.pulseTimer = String(window.setTimeout(() => delete root.dataset.pulse, 900));
}

function messageFor(error: unknown): string {
  return error instanceof ApiError && error.userMessage ? error.userMessage : copy.errors.taskChangedMeanwhile;
}

export function TodayTasks({
  tasks,
  tomorrow = [],
  me,
  partner,
  today,
  initialView = 'together',
}: {
  tasks: TaskView[];
  /** Tomorrow's list, shown folded under today's so the next day can be seen coming. */
  tomorrow?: TaskView[];
  me: PartnerRef;
  partner: PartnerRef | null;
  today: CalendarDate;
  /** How this person last arranged the list (a cookie, so the first paint is already right). */
  initialView?: TodayView;
}) {
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [arrangement, setArrangement] = useState<TodayView>(partner ? initialView : 'together');
  const router = useRouter();
  const toast = useToast();

  const [optimistic, setOptimistic] = useState<Record<string, Partial<TaskView>>>({});
  const confirmed = useRef<Record<string, TaskView>>({});
  const chain = useRef<Record<string, Promise<void>>>({});

  const [editing, setEditing] = useState<TaskView | null>(null);
  const [adding, setAdding] = useState(false);
  /** Asked to delete from the edit screen: waiting for the confirmation. */
  const [confirming, setConfirming] = useState<TaskView | null>(null);
  /** The one row swiped open, if any. */
  const [swiped, setSwiped] = useState<string | null>(null);
  /** Rows folding away while their delete reaches the server. */
  const [removing, setRemoving] = useState<Record<string, true>>({});
  const [rating, setRating] = useState<TaskView | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  /** Tasks that arrived while this screen was open (a task just sent). */
  const [fresh, setFresh] = useState<Record<string, true>>({});

  /** Where each task sits: its group and position when this screen first saw it. */
  const [seen, setSeen] = useState<Record<string, { group: number; index: number }>>(() =>
    Object.fromEntries(tasks.map((task, index) => [task.id, { group: task.state === 'COMPLETED' ? 1 : 0, index }])),
  );
  const unseen = tasks.filter((task) => !(task.id in seen));
  if (unseen.length > 0) {
    setFresh((previous) => ({
      ...previous,
      ...Object.fromEntries(unseen.map((task) => [task.id, true as const])),
    }));
    setSeen((previous) => {
      const next = { ...previous };
      for (const task of unseen) {
        next[task.id] = {
          group: task.state === 'COMPLETED' ? 1 : 0,
          index: Object.keys(next).length,
        };
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
    setRemoving((previous) => {
      const { [id]: _gone, ...rest } = previous;
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
    if (next === 'COMPLETED') pulse(current.ownerId === me.id ? me.side : (partner?.side ?? me.side));
    setOptimistic((previous) => ({
      ...previous,
      [task.id]: {
        state: next,
        awaitingPartnerRating: next === 'COMPLETED' && current.rating === null && current.ownerId === me.id,
        permissions: {
          ...current.permissions,
          rate: next === 'COMPLETED' && current.ownerId !== me.id,
        },
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
      [task.id]: {
        ...previous[task.id],
        rating: { value, ratedByName: me.name },
        awaitingPartnerRating: false,
      },
    }));
    enqueue(task.id, async () => {
      await apiRequest('/api/task-ratings', {
        method: 'POST',
        body: { taskId: task.id, value },
      });
      router.refresh();
    });
  }

  const ordered = tasks.map(view).sort((a, b) => {
    const x = seen[a.id] ?? { group: 0, index: 0 };
    const y = seen[b.id] ?? { group: 0, index: 0 };
    return x.group - y.group || x.index - y.index;
  });

  /** Deleting, for good: the row folds away at once; the server follows. */
  function remove(task: TaskView) {
    setSwiped(null);
    setRemoving((previous) => ({ ...previous, [task.id]: true }));
    enqueue(task.id, async () => {
      const from = base(task);
      await apiRequest(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        body: { id: task.id, version: from.version },
      });
      router.refresh();
    });
  }

  const ownerOf = (task: TaskView | null) => (task ? (task.ownerId === me.id ? me : partner) : null);

  const live = ordered.filter((task) => !removing[task.id]);

  const row = (task: TaskView) => (
    <TaskRow
      key={task.id}
      task={task}
      me={me}
      partner={partner}
      onToggle={toggle}
      onOpen={setEditing}
      onRate={setRating}
      fresh={Boolean(fresh[task.id])}
      swiped={swiped === task.id}
      onSwipe={(open) => setSwiped(open ? task.id : null)}
      onDelete={remove}
      removing={Boolean(removing[task.id])}
    />
  );

  return (
    <>
      <DayProgress
        tasks={live}
        me={me}
        partner={partner}
        arrangement={arrangement}
        onArrange={(next) => {
          setSwiped(null);
          setArrangement(next);
          document.cookie = `${TODAY_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        }}
      />

      {ordered.length === 0 ? (
        <p className="px-2 pt-10 text-center text-title font-semibold text-ink-subtle">{copy.today.emptyTitle}</p>
      ) : arrangement === 'person' && partner ? (
        // Each person's own list, mine first — the same rows, under a name.
        <div key="person" className="list-swap space-y-5">
          {[me, partner].map((person) => {
            const theirs = ordered.filter((task) => task.ownerId === person.id);
            const left = theirs.filter((task) => !removing[task.id]);
            const title = person.id === me.id ? copy.today.mine : copy.today.theirs(person.name.split(' ')[0] ?? person.name);
            return (
              <section key={person.id} aria-label={title}>
                <h3 className="mb-1.5 flex items-center gap-2 px-3 text-meta font-semibold text-ink-muted">
                  <PartnerAvatar person={person} size={person.photo ? 1.375 : 0.625} />
                  {title}
                  <span className="tabular-nums">
                    · {copy.today.progress(left.filter((task) => task.state === 'COMPLETED').length, left.length)}
                  </span>
                </h3>
                {theirs.length > 0 ? (
                  <ul className="glass overflow-hidden [&>li+li]:border-t [&>li+li]:border-rule-faint" aria-label={title}>
                    {theirs.map(row)}
                  </ul>
                ) : (
                  <p className="glass px-4 py-4 text-body text-ink-muted">{copy.today.sectionEmpty}</p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <ul
          key="together"
          className="list-swap glass overflow-hidden [&>li+li]:border-t [&>li+li]:border-rule-faint"
          aria-label={copy.today.listTitle}
        >
          {ordered.map(row)}
        </ul>
      )}

      {tomorrow.length > 0 && (
        <section className="mt-5" aria-label={copy.today.tomorrowTitle}>
          <button
            type="button"
            aria-expanded={showTomorrow}
            onClick={() => setShowTomorrow((value) => !value)}
            className="tap-quiet press flex min-h-11 w-full items-center justify-between gap-3 px-3 text-body font-semibold text-ink-muted focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span>
              {copy.today.tomorrowTitle} · {copy.today.taskCount(tomorrow.filter((task) => !removing[task.id]).length)}
            </span>
            <ChevronDown aria-hidden="true" size={18} className={cx('transition-transform duration-300', showTomorrow && 'rotate-180')} />
          </button>
          {/* Folds open smoothly (grid rows), never a jump. */}
          <div className="fold" data-open={showTomorrow}>
            <div className="min-h-0 overflow-hidden">
              <ul
                className="glass mt-1 overflow-hidden [&>li+li]:border-t [&>li+li]:border-rule-faint"
                aria-label={copy.today.tomorrowTitle}
              >
                {tomorrow.map(view).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    me={me}
                    partner={partner}
                    onToggle={toggle}
                    onOpen={setEditing}
                    onRate={setRating}
                    swiped={swiped === task.id}
                    onSwipe={(open) => setSwiped(open ? task.id : null)}
                    onDelete={remove}
                    removing={Boolean(removing[task.id])}
                  />
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* The one action. Above the tab bar, where the thumb already is. */}
      <button
        ref={addButton}
        type="button"
        onClick={() => {
          primeKeyboard();
          setAdding(true);
        }}
        aria-label={copy.tasks.addAction}
        className="fab fab-couple tap-quiet fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 mx-auto flex h-[3.75rem] w-fit items-center gap-2.5 rounded-full ps-5 pe-7 text-[1.0625rem] font-bold text-on-partner focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:bottom-8"
      >
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full fab-plus">
          <Plus size={22} strokeWidth={2.6} />
        </span>
        <span aria-hidden="true">{copy.tasks.addShort}</span>
      </button>

      <Composer
        open={adding || editing !== null}
        returnFocus={editing ? undefined : addButton}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        task={editing}
        defaultDate={today}
        me={me}
        partner={partner}
        onDelete={
          editing
            ? (task) => {
                setEditing(null);
                setTimeout(() => setConfirming(task), 220);
              }
            : undefined
        }
        onRate={
          editing
            ? (task) => {
                setEditing(null);
                setTimeout(() => setRating(task), 220);
              }
            : undefined
        }
      />

      <RateSheet task={rating} owner={ownerOf(rating)} onRate={rate} onClose={() => setRating(null)} />

      <ConfirmDialog
        open={confirming !== null}
        title={copy.tasks.deleteTitle}
        body={copy.tasks.deleteBody}
        confirmLabel={copy.tasks.deleteShort}
        tone="danger"
        onConfirm={() => {
          const task = confirming;
          setConfirming(null);
          if (task) remove(task);
        }}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

/**
 * HOW THE DAY IS GOING — the one number the owner asked to see at a glance.
 *
 *   מה יש לנו היום                       3 מתוך 7
 *   [███████████░░░░░░░░░░░░░]  (my share | their share | left)
 *   ● אני 2 מתוך 4      ● נטיה 1 מתוך 3
 *
 * Counted from the list on screen, so a tick moves the bar at once (the
 * server follows). The bar is split by whose tasks were done, in their colours.
 */
function DayProgress({
  tasks,
  me,
  partner,
  arrangement,
  onArrange,
}: {
  tasks: TaskView[];
  me: PartnerRef;
  partner: PartnerRef | null;
  arrangement: TodayView;
  onArrange: (next: TodayView) => void;
}) {
  const total = tasks.length;
  const doneBy = (id: string) => tasks.filter((task) => task.ownerId === id && task.state === 'COMPLETED').length;
  const of = (id: string) => tasks.filter((task) => task.ownerId === id).length;
  const done = tasks.filter((task) => task.state === 'COMPLETED').length;
  const people = partner ? [me, partner] : [me];
  const share = (count: number) => (total === 0 ? 0 : (count / total) * 100);

  return (
    <section aria-labelledby="today-list-title" className="mb-3 px-1">
      <div className="flex items-baseline justify-between gap-3 px-2">
        <h2 id="today-list-title" className="text-meta font-semibold text-ink-muted">
          {copy.today.listTitle}
        </h2>
        {total > 0 && <p className="text-body font-semibold text-ink tabular-nums">{copy.today.progress(done, total)}</p>}
      </div>
      {total > 0 && (
        <>
          <div
            role="progressbar"
            aria-label={copy.today.progressLabel}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-valuetext={copy.today.progress(done, total)}
            dir="ltr"
            className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-rule)]"
          >
            {people.map((person) => (
              <span
                key={person.id}
                className={cx('progress-part h-full', person.side === 'a' ? 'bg-partner-a' : 'bg-partner-b')}
                style={{ width: `${share(doneBy(person.id))}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2">
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-meta text-ink-muted">
              {people.map((person) => (
                <span key={person.id} className="flex items-center gap-1.5 tabular-nums">
                  <PartnerAvatar person={person} size={person.photo ? 1.375 : 0.625} />
                  {person.id === me.id ? copy.common.me : person.name.split(' ')[0]} {copy.today.progress(doneBy(person.id), of(person.id))}
                </span>
              ))}
            </p>
            {partner && (
              // Together, or each person's own list (mine first). Two words, one tap.
              <div role="radiogroup" aria-label={copy.today.viewLabel} className="segmented" data-at={arrangement}>
                {(['together', 'person'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={arrangement === value}
                    onClick={() => onArrange(value)}
                    className="segmented-option tap-quiet focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                  >
                    {value === 'together' ? copy.today.viewTogether : copy.today.viewByPerson}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
