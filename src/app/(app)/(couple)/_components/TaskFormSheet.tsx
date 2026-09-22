'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { RadioGroup } from '@/core/ui/components/Choice';
import { DateInput } from '@/core/ui/components/DateInput';
import { BottomSheet, ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Input, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { TimeInput } from '@/core/ui/components/TimeInput';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { CalendarDate } from '@/core/dates/calendar-date';
import type { LocalTime } from '@/core/dates/local-time';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

/**
 * Adding or editing a task.
 *
 * A bottom sheet, not a page: it is a five-field task done one-handed while
 * something else is on screen. The primary action sits in the pinned footer so
 * it stays above the keyboard, and the sheet cannot be dismissed mid-save.
 *
 * "Who is responsible" is a two-option segmented control rather than a select,
 * because there are exactly two people and the answer should cost one tap.
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

  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState(me.id);
  // The core date and time inputs use '' for "nothing readable in the field"
  // rather than null, so an unparseable value never holds a stale one.
  const [date, setDate] = useState<CalendarDate | ''>(defaultDate);
  const [time, setTime] = useState<LocalTime | ''>('');
  const [note, setNote] = useState('');

  // Reload the fields each time the sheet opens, so reopening never shows the
  // previous task's values for a frame. Render-phase adjustment against a
  // sentinel — the pattern the foundation's own dialogs use, and not an effect.
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

  const ownerOptions = partner
    ? [
        { value: me.id, label: copy.tasks.ownerMe },
        { value: partner.id, label: partner.name },
      ]
    : [{ value: me.id, label: copy.tasks.ownerMe }];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={task ? copy.tasks.editTitle : copy.tasks.addTitle}
      dismissible={!pending}
      footer={
        <Button variant="primary" onClick={save} loading={pending} className="w-full">
          {task ? copy.common.save : copy.common.add}
        </Button>
      }
    >
      <form method="post" onInput={clearOnInput} onSubmit={(event) => event.preventDefault()} className="space-y-4">
        <FormError message={formError} />

        <FormField label={copy.tasks.titleLabel} name="title" error={fieldErrors.title} required>
          {(props) => (
            <Input
              {...props}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={copy.tasks.titlePlaceholder}
              autoComplete="off"
              enterKeyHint="done"
            />
          )}
        </FormField>

        <RadioGroup
          legend={copy.tasks.ownerLabel}
          name="ownerId"
          value={ownerId}
          onChange={setOwnerId}
          error={fieldErrors.ownerId}
          layout="segmented"
          options={ownerOptions}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={copy.tasks.dateLabel} name="taskDate" error={fieldErrors.taskDate} required>
            {(props) => <DateInput {...props} name="taskDate" value={date} onChange={setDate} />}
          </FormField>

          <FormField label={copy.tasks.timeLabel} name="dueTime" hint={copy.tasks.timeHint} error={fieldErrors.dueTime}>
            {(props) => <TimeInput {...props} name="dueTime" value={time} onChange={setTime} />}
          </FormField>
        </div>

        <FormField label={copy.tasks.noteLabel} name="note" hint={copy.tasks.noteHint} error={fieldErrors.note}>
          {(props) => (
            <Textarea {...props} name="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </FormField>

        {/* Quiet, and last: archiving is rare and irreversible-feeling, so it
            is never next to the primary action. Absent when the server would
            refuse it. */}
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

/**
 * Archiving needs a reason (R-TASK-05): the reason is the whole value of
 * archiving over deleting, and it is what the archive screen shows later. The
 * confirm button stays disabled until there is one, and the body says what
 * archiving actually does rather than asking "are you sure?".
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
