'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { formatCalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';
import type { PartnerRef } from '@/domain/partners';
import type { TaskView } from '@/domain/tasks/tasks';

import { PartnerMark } from './PartnerMark';

/**
 * THE ARCHIVE.
 *
 * Archiving is the product's only way of removing a task, and it is not a
 * delete: the row stays, with the reason, and the summaries stop counting it.
 * So this screen's job is to make that reversible and to show the reason —
 * "we decided not to" is worth reading again a month later.
 *
 * Restoring asks for its own reason, because the lifecycle requires one
 * (R-TASK-05). A task coming back is work again, not history, so it returns as
 * OPEN on the day it was attached to.
 */
export function ArchiveList({
  tasks,
  me,
  partner,
}: {
  tasks: TaskView[];
  me: PartnerRef;
  partner: PartnerRef | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { submit, pending, fieldErrors } = useSubmit();

  const [restoring, setRestoring] = useState<TaskView | null>(null);
  const [reason, setReason] = useState('');

  async function restore() {
    if (!restoring) return;
    const result = await submit(`/api/tasks/${restoring.id}/transition`, {
      method: 'POST',
      body: { id: restoring.id, version: restoring.version, to: 'OPEN', reason },
    });
    if (result === null) {
      toast.show(copy.errors.taskChangedMeanwhile, 'error');
      return;
    }
    setRestoring(null);
    setReason('');
    toast.show(copy.archivePage.restoreDone);
    router.refresh();
  }

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {tasks.map((task) => {
          const ownerIsMe = task.ownerId === me.id;
          const ownerRef = ownerIsMe ? me : (partner ?? me);

          return (
            <li key={task.id} className="card p-4">
              <p className="text-row leading-snug font-medium text-ink-subtle line-through">{task.title}</p>

              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <PartnerMark partner={ownerRef} size={18} />
                  <span className="text-meta text-ink-subtle">
                    {ownerIsMe ? copy.tasks.ownerMe : copy.tasks.ownerPartner(ownerRef.name)}
                  </span>
                </span>
                <span className="text-meta text-ink-subtle" dir="ltr">
                  {formatCalendarDate(task.taskDate)}
                </span>
              </p>

              {task.archiveReason && (
                <p className="mt-3 border-t border-rule-faint pt-3 text-body text-ink-muted">
                  <span className="text-meta text-ink-subtle">{copy.archivePage.reasonGiven}: </span>
                  {task.archiveReason}
                </p>
              )}

              {task.permissions.restore && (
                <div className="mt-3">
                  <Button variant="secondary" onClick={() => setRestoring(task)}>
                    {copy.tasks.restoreAction}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={restoring !== null}
        title={copy.archivePage.restoreTitle}
        body={copy.archivePage.restoreBody}
        confirmLabel={copy.tasks.restoreAction}
        confirmDisabled={reason.trim().length < 3}
        onConfirm={restore}
        onCancel={() => {
          setRestoring(null);
          setReason('');
        }}
      >
        <FormField label={copy.archivePage.restoreReasonLabel} name="reason" error={fieldErrors.reason} required>
          {(props) => (
            <Textarea
              {...props}
              name="reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending}
            />
          )}
        </FormField>
      </ConfirmDialog>
    </>
  );
}
