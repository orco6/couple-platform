'use client';

import { AlignRight, Clock } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { DateInput } from '@/core/ui/components/DateInput';
import { BottomSheet, ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Input, Textarea } from '@/core/ui/components/Field';
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

import { PartnerMark } from './PartnerMark';

/**
 * iOS raises the keyboard only for a focus() made inside the tap itself, and
 * the sheet's input does not exist yet at that moment. So the tap focuses a
 * throwaway input, synchronously; when the sheet then moves focus into its own
 * field, iOS keeps the keyboard up instead of never showing it. The throwaway
 * is gone again before the sheet could try to restore focus to it.
 */
export function primeKeyboard() {
  if (typeof document === 'undefined') return;
  const proxy = document.createElement('input');
  proxy.setAttribute('aria-hidden', 'true');
  proxy.tabIndex = -1;
  proxy.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none;';
  document.body.appendChild(proxy);
  proxy.focus({ preventScroll: true });
  window.setTimeout(() => proxy.remove(), 800);
}

type DateChoice = 'today' | 'tomorrow' | 'other';

/**
 * THE COMPOSER — adding or editing a task.
 *
 * Tap, type, choose who, save. The first edition was a five-field form with
 * required asterisks, a date field and two "optional" hints; on a phone at
 * night that is paperwork for "buy milk". Now the only thing on the sheet by
 * default is the sentence and the two people. The day is three chips (today is
 * already chosen), and a time or a note is one tap away and otherwise absent.
 *
 * Enter saves. The field has focus the moment the sheet opens (see
 * primeKeyboard for iOS), and the save button is pinned above the keyboard.
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
  const [dateChoice, setDateChoice] = useState<DateChoice>('today');
  const [time, setTime] = useState<LocalTime | ''>('');
  const [note, setNote] = useState('');
  const [showTime, setShowTime] = useState(false);
  const [showNote, setShowNote] = useState(false);

  // Reload the fields each time the sheet opens (render-phase, against a sentinel).
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const identity = open ? (task?.id ?? 'new') : null;
  if (identity !== openedFor) {
    setOpenedFor(identity);
    if (open) {
      reset();
      const taskDate = task?.taskDate ?? defaultDate;
      setTitle(task?.title ?? '');
      setOwnerId(task?.ownerId ?? me.id);
      setDate(taskDate);
      setDateChoice(taskDate === defaultDate ? 'today' : taskDate === tomorrow ? 'tomorrow' : 'other');
      setTime(task?.dueTime ?? '');
      setNote(task?.note ?? '');
      setShowTime(Boolean(task?.dueTime));
      setShowNote(Boolean(task?.note));
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

  function chooseDate(choice: DateChoice) {
    setDateChoice(choice);
    if (choice === 'today') setDate(defaultDate);
    if (choice === 'tomorrow') setDate(tomorrow);
  }

  const people = partner ? [me, partner] : [me];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={task ? copy.tasks.editTitle : copy.tasks.addTitle}
      dismissible={!pending}
      initialFocus={titleRef}
      footer={
        <Button variant="primary" onClick={save} loading={pending} className="w-full">
          {task ? copy.common.save : copy.common.add}
        </Button>
      }
    >
      <form method="post" onInput={clearOnInput} onSubmit={(event) => event.preventDefault()} className="space-y-5">
        <FormError message={formError} />

        <FormField label={copy.tasks.titleLabel} name="title" error={fieldErrors.title} hideLabel>
          {(props) => (
            <Input
              {...props}
              ref={titleRef}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void save();
                }
              }}
              placeholder={copy.tasks.titlePlaceholder}
              autoComplete="off"
              enterKeyHint="done"
              className="min-h-14 text-[1.125rem] font-medium"
            />
          )}
        </FormField>

        {/* Who. Two people, two tiles, one tap. A fieldset, so it is a named
            group; the radios are visually hidden and the tile is the target. */}
        <fieldset>
          <legend className="mb-2 text-label font-semibold text-ink-muted">{copy.tasks.ownerLabel}</legend>
          <div className="grid grid-cols-2 gap-2">
            {people.map((person) => {
              const checked = ownerId === person.id;
              return (
                <label
                  key={person.id}
                  className={cx(
                    'tap-quiet press flex min-h-14 cursor-pointer items-center gap-2.5 rounded-control px-3 transition-[background-color,box-shadow] duration-200',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                    checked
                      ? 'bg-selected shadow-[inset_0_0_0_2px_var(--color-accent)]'
                      : 'bg-sunken shadow-[inset_0_0_0_1px_var(--color-rule)]',
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
                  <PartnerMark partner={person} size={28} />
                  <span className={cx('truncate text-row', checked ? 'font-semibold text-ink' : 'text-ink-muted')}>
                    {person.id === me.id ? copy.tasks.ownerMe : person.name}
                  </span>
                </label>
              );
            })}
          </div>
          {fieldErrors.ownerId && <p className="mt-1.5 text-label font-medium text-danger-text">{fieldErrors.ownerId}</p>}
        </fieldset>

        {/* When: a three-way control with today already chosen. */}
        <fieldset>
          <legend className="sr-only">{copy.tasks.dateLabel}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-control bg-sunken p-1 shadow-[inset_0_0_0_1px_var(--color-rule-faint)]">
            {(
              [
                ['today', copy.common.today],
                ['tomorrow', copy.tasks.tomorrow],
                ['other', copy.tasks.otherDay],
              ] as const
            ).map(([choice, label]) => (
              <label
                key={choice}
                className={cx(
                  'tap-quiet press flex min-h-10 cursor-pointer items-center justify-center rounded-[10px] text-body transition-[background-color,color,box-shadow] duration-200',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus',
                  dateChoice === choice ? 'bg-surface font-semibold text-ink shadow-[var(--brand-shadow-card)]' : 'text-ink-muted',
                )}
              >
                <input
                  type="radio"
                  name="dateChoice"
                  checked={dateChoice === choice}
                  onChange={() => chooseDate(choice)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* The two extras: absent until asked for. */}
        {(!showTime || !showNote) && (
          <div className="flex gap-2">
            {!showTime && (
              <button type="button" onClick={() => setShowTime(true)} className={extraClass}>
                <Clock aria-hidden="true" size={15} />
                {copy.tasks.addTime}
              </button>
            )}
            {!showNote && (
              <button type="button" onClick={() => setShowNote(true)} className={extraClass}>
                <AlignRight aria-hidden="true" size={15} />
                {copy.tasks.addNote}
              </button>
            )}
          </div>
        )}

        {dateChoice === 'other' && (
          <FormField label={copy.tasks.dateLabel} name="taskDate" error={fieldErrors.taskDate}>
            {(props) => <DateInput {...props} name="taskDate" value={date} onChange={setDate} />}
          </FormField>
        )}

        {showTime && (
          <FormField label={copy.tasks.timeLabel} name="dueTime" error={fieldErrors.dueTime}>
            {(props) => <TimeInput {...props} name="dueTime" value={time} onChange={setTime} />}
          </FormField>
        )}

        {showNote && (
          <FormField label={copy.tasks.noteLabel} name="note" error={fieldErrors.note}>
            {(props) => (
              <Textarea {...props} name="note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            )}
          </FormField>
        )}

        {task && onArchive && task.permissions.archive && (
          <div className="border-t border-rule-faint pt-4">
            <Button variant="quiet" onClick={() => onArchive(task)} disabled={pending} className="text-danger-text">
              {copy.tasks.archiveAction}
            </Button>
          </div>
        )}
      </form>
    </BottomSheet>
  );
}

const extraClass = cx(
  'tap-quiet press inline-flex min-h-10 items-center gap-1.5 rounded-chip px-3 text-body font-medium text-accent-text',
  'transition-colors duration-200 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
);

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
