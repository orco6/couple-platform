'use client';

import { ArrowUp, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { DateInput } from '@/core/ui/components/DateInput';
import { ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { TimeInput } from '@/core/ui/components/TimeInput';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { cx } from '@/core/ui/cx';
import { addDays, type CalendarDate } from '@/core/dates/calendar-date';
import type { LocalTime } from '@/core/dates/local-time';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { Sheet } from './Sheet';

/**
 * iOS raises the keyboard only for a focus() made inside the tap itself, and
 * the sheet's input does not exist yet at that moment. So the tap focuses a
 * throwaway input, synchronously — placed low, where the sheet's field will
 * be, so Safari has no reason to scroll — and when the sheet moves focus into
 * its own field the keyboard simply stays. The throwaway is gone before the
 * sheet could restore focus to it.
 */
export function primeKeyboard() {
  if (typeof document === 'undefined') return;
  const proxy = document.createElement('input');
  proxy.setAttribute('aria-hidden', 'true');
  proxy.tabIndex = -1;
  proxy.style.cssText =
    'position:fixed;bottom:30vh;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none;';
  document.body.appendChild(proxy);
  proxy.focus({ preventScroll: true });
  window.setTimeout(() => proxy.remove(), 800);
}

/**
 * THE COMPOSER — as close to sending a message as a task can get.
 *
 *   [ מה צריך לעשות?                        (↑) ]
 *   (● אני) (● נטיה)                   מחר    ⋯
 *
 * Type, pick who, send. Tomorrow is one tap; a time, a note or another day are
 * behind "⋯" and absent until asked for. The sheet never changes height while
 * typing, and the field and its send button sit above the keyboard (Sheet).
 * Enter sends. Editing an existing task opens the same sheet with its extras
 * already showing, plus archive.
 */
export function TaskFormSheet({
  open,
  onClose,
  task,
  defaultDate,
  me,
  partner,
  onArchive,
}: {
  open: boolean;
  onClose: () => void;
  task?: TaskView | null;
  defaultDate: CalendarDate;
  me: PartnerRef;
  partner: PartnerRef | null;
  onArchive?: (task: TaskView) => void;
}) {
  const router = useRouter();
  const { pending, fieldErrors, formError, submit, clearOnInput, reset } = useSubmit();
  const titleRef = useRef<HTMLInputElement>(null);
  const tomorrow = addDays(defaultDate, 1);

  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState(me.id);
  const [date, setDate] = useState<CalendarDate | ''>(defaultDate);
  const [time, setTime] = useState<LocalTime | ''>('');
  const [note, setNote] = useState('');
  const [more, setMore] = useState(false);

  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const identity = open ? (task?.id ?? 'new') : null;
  if (identity !== openedFor) {
    setOpenedFor(identity);
    if (open) {
      reset();
      setTitle(task?.title ?? '');
      setOwnerId(task?.ownerId ?? me.id);
      setDate(task?.taskDate ?? defaultDate);
      setTime(task?.dueTime ?? '');
      setNote(task?.note ?? '');
      setMore(Boolean(task && (task.dueTime || task.note || (task.taskDate !== defaultDate && task.taskDate !== tomorrow))));
    }
  }

  async function save() {
    const body = {
      title,
      ownerId,
      taskDate: date === '' ? defaultDate : date,
      dueTime: time === '' ? null : time,
      note: note.trim() === '' ? null : note,
    };
    const result = task
      ? await submit(`/api/tasks/${task.id}`, { method: 'PATCH', body: { ...body, version: task.version } })
      : await submit('/api/tasks', { method: 'POST', body });
    if (result === null) return;
    router.refresh();
    onClose();
  }

  const people = partner ? [me, partner] : [me];
  const isTomorrow = date === tomorrow;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={task ? copy.tasks.editTitle : copy.tasks.addTitle}
      dismissible={!pending}
      initialFocus={titleRef}
      testId="task-sheet"
    >
      <form
        method="post"
        onInput={clearOnInput}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FormError message={formError} />

        {/* The sentence and send, one line. */}
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="task-title">
            {copy.tasks.titleLabel}
          </label>
          <input
            id="task-title"
            ref={titleRef}
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.tasks.titlePlaceholder}
            autoComplete="off"
            enterKeyHint="send"
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={fieldErrors.title ? 'task-title-error' : undefined}
            className="min-h-14 min-w-0 flex-1 rounded-[1.25rem] bg-surface px-4 text-[1.125rem] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-rule)] outline-none placeholder:text-ink-subtle focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          />
          <button
            type="submit"
            aria-label={task ? copy.common.save : copy.common.add}
            aria-busy={pending || undefined}
            className="tap-quiet press grid size-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-[var(--brand-shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ArrowUp aria-hidden="true" size={22} strokeWidth={2.4} />
          </button>
        </div>
        {fieldErrors.title && (
          <p id="task-title-error" className="mt-1.5 ps-2 text-label font-medium text-danger-text">
            {fieldErrors.title}
          </p>
        )}

        {/* Who, and when — one quiet row. */}
        <div className="mt-3 flex items-center gap-2">
          <fieldset className="flex gap-2">
            <legend className="sr-only">{copy.tasks.ownerLabel}</legend>
            {people.map((person) => {
              const checked = ownerId === person.id;
              return (
                <label
                  key={person.id}
                  className={cx(
                    'tap-quiet press flex min-h-10 cursor-pointer items-center gap-2 rounded-chip ps-1.5 pe-3.5 text-body transition-[background-color,color,box-shadow] duration-200',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                    checked ? 'bg-surface font-semibold text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'text-ink-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="ownerId"
                    value={person.id}
                    checked={checked}
                    onChange={() => setOwnerId(person.id)}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className={cx(person.side === 'a' ? 'light-a' : 'light-b', 'size-6')} />
                  {person.id === me.id ? copy.common.me : person.name.split(' ')[0]}
                </label>
              );
            })}
          </fieldset>

          <span className="flex-1" />

          <button
            type="button"
            aria-pressed={isTomorrow}
            onClick={() => setDate(isTomorrow ? defaultDate : tomorrow)}
            className={cx(
              'tap-quiet press min-h-10 rounded-chip px-3 text-body transition-[background-color,color,box-shadow] duration-200',
              isTomorrow ? 'bg-surface font-semibold text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'text-ink-muted',
            )}
          >
            {copy.tasks.tomorrow}
          </button>
          <button
            type="button"
            aria-expanded={more}
            aria-label={copy.tasks.moreOptions}
            onClick={() => setMore((value) => !value)}
            className="tap-quiet press grid size-10 place-items-center rounded-full text-ink-muted"
          >
            <MoreHorizontal aria-hidden="true" size={20} />
          </button>
        </div>

        {more && (
          <div className="mt-4 space-y-3 border-t border-rule-faint pt-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label={copy.tasks.dateLabel} name="taskDate" error={fieldErrors.taskDate}>
                {(props) => <DateInput {...props} name="taskDate" value={date} onChange={setDate} />}
              </FormField>
              <FormField label={copy.tasks.timeLabel} name="dueTime" error={fieldErrors.dueTime}>
                {(props) => <TimeInput {...props} name="dueTime" value={time} onChange={setTime} />}
              </FormField>
            </div>
            <FormField label={copy.tasks.noteLabel} name="note" error={fieldErrors.note}>
              {(props) => (
                <Textarea {...props} name="note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              )}
            </FormField>
          </div>
        )}

        {task && onArchive && task.permissions.archive && (
          <div className="mt-3 text-center">
            <Button variant="quiet" onClick={() => onArchive(task)} disabled={pending} className="text-danger-text">
              {copy.tasks.archiveAction}
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  );
}

/**
 * Archiving needs a reason (R-TASK-05): the reason is the whole value of
 * archiving over deleting, and it is what the archive screen shows later.
 */
export function ArchiveDialog({
  task,
  onClose,
  onArchived,
}: {
  task: TaskView | null;
  onClose: () => void;
  onArchived: () => void;
}) {
  const toast = useToast();
  const { submit, fieldErrors } = useSubmit();
  const [reason, setReason] = useState('');

  async function archive() {
    if (!task) return;
    const result = await submit(`/api/tasks/${task.id}/transition`, {
      method: 'POST',
      body: { id: task.id, version: task.version, to: 'ARCHIVED', reason },
    });
    if (result === null) {
      toast.show(copy.errors.taskChangedMeanwhile, 'error');
      return;
    }
    setReason('');
    onArchived();
  }

  return (
    <ConfirmDialog
      open={task !== null}
      title={copy.tasks.archiveTitle}
      body={copy.tasks.archiveBody}
      confirmLabel={copy.tasks.archiveAction}
      confirmDisabled={reason.trim().length < 3}
      onConfirm={archive}
      onCancel={() => {
        setReason('');
        onClose();
      }}
    >
      <FormField label={copy.tasks.archiveReasonLabel} name="reason" error={fieldErrors.reason} required>
        {(props) => (
          <Textarea {...props} name="reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        )}
      </FormField>
    </ConfirmDialog>
  );
}
