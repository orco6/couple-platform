'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { copy } from '@/core/copy';
import { todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import { apiRequest, ApiError } from '@/core/http/client';
import { Button } from '@/core/ui/components/Button';
import { ConfirmDialog, Dialog } from '@/core/ui/components/Dialog';
import { DateInput } from '@/core/ui/components/DateInput';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FormError, Notice } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { TaskView } from '@/domain/sample/tasks';
import { TaskFormDialog } from '../TaskFormDialog';

type Transition = TaskView['permissions']['transitions'][number];

export function TaskActions({
  task,
  assignees,
  canPrice,
}: {
  task: TaskView;
  assignees?: Array<{ id: string; name: string }>;
  canPrice: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<Transition | null>(null);
  const [completedOn, setCompletedOn] = useState<CalendarDate | ''>('');
  const [dateInvalid, setDateInvalid] = useState(false);
  const [reason, setReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const { submit, pending, fieldErrors, formError, reset, clearOnInput } = useSubmit();

  async function runTransition(transition: Transition, extra: Record<string, unknown> = {}) {
    const result = await submit<TaskView>(`/api/tasks/${task.id}/transition`, {
      body: { version: task.version, to: transition.to, ...extra },
    });
    if (!result) return false;
    toast.show(`הסטטוס עודכן: ${result.statusLabel}`);
    router.refresh();
    return true;
  }

  function choose(transition: Transition) {
    reset();
    if (transition.to === 'DONE' || transition.requiresReason) {
      setCompletedOn(todayIn());
      setReason('');
      setPendingTransition(transition);
      return;
    }
    void runTransition(transition);
  }

  const needsDate = pendingTransition?.to === 'DONE';

  return (
    <>
      {task.lockedPeriod && (
        <Notice className="w-full">
          {task.lockedPeriod} סגור: הסטטוס, המחיר והאחראי נעולים עד שהחודש ייפתח מחדש.
        </Notice>
      )}
      {task.permissions.transitions.map((transition) => (
        <Button
          key={transition.to}
          variant={transition.to === 'DONE' ? 'primary' : 'secondary'}
          onClick={() => choose(transition)}
          loading={pending && pendingTransition === null}
        >
          {transition.label}
        </Button>
      ))}
      {task.permissions.edit && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          עריכה
        </Button>
      )}
      {task.permissions.archive && (
        <Button
          variant="quiet"
          onClick={() => {
            setArchiveError(null);
            setArchiving(true);
          }}
        >
          לארכיון
        </Button>
      )}
      {formError && pendingTransition === null && (
        <p role="alert" className="w-full text-body font-medium text-danger-text">
          {formError}
        </p>
      )}

      <TaskFormDialog open={editing} onClose={() => setEditing(false)} task={task} assignees={task.permissions.reassign ? assignees : undefined} canPrice={canPrice && task.permissions.setPrice} />

      <Dialog
        open={pendingTransition !== null}
        onClose={() => setPendingTransition(null)}
        dismissible={!pending}
        size="sm"
        title={pendingTransition?.label ?? ''}
        description={needsDate ? 'תאריך הביצוע קובע לאיזה חודש תיספר ההכנסה.' : 'פתיחה מחדש של משימה שנסגרה נרשמת ביומן עם הסיבה.'}
        footer={
          <div className="flex gap-2.5 sm:justify-end">
            <Button variant="secondary" onClick={() => setPendingTransition(null)} disabled={pending} className="flex-1 sm:flex-none">
              ביטול
            </Button>
            <Button
              variant="primary"
              loading={pending}
              className="flex-1 sm:flex-none"
              onClick={async () => {
                if (!pendingTransition) return;
                if (needsDate && (dateInvalid || !completedOn)) return;
                const ok = await runTransition(pendingTransition, needsDate ? { completedOn } : { reason });
                if (ok) setPendingTransition(null);
              }}
            >
              {pendingTransition?.label}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4" onInput={clearOnInput}>
          {needsDate ? (
            <FormField
              name="completedOn"
              label="תאריך ביצוע"
              required
              error={fieldErrors.completedOn ?? (dateInvalid || !completedOn ? copy.validation.invalidDate : undefined)}
            >
              {(props) => <DateInput {...props} value={completedOn} onChange={setCompletedOn} onInvalidChange={setDateInvalid} max={todayIn()} />}
            </FormField>
          ) : (
            <FormField name="reason" label="סיבה" required error={fieldErrors.reason}>
              {(props) => <Textarea {...props} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />}
            </FormField>
          )}
          <FormError message={formError} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={archiving}
        title="העברת המשימה לארכיון"
        body="המשימה תוסתר מהרשימות. אם בוצעה, היא ממשיכה להיספר בהכנסות של החודש שבו בוצעה."
        confirmLabel="העברה לארכיון"
        onCancel={() => setArchiving(false)}
        onConfirm={async () => {
          try {
            await apiRequest(`/api/tasks/${task.id}/archive`, { method: 'POST' });
            setArchiving(false);
            toast.show('המשימה הועברה לארכיון');
            router.push('/tasks');
            router.refresh();
          } catch (caught) {
            setArchiveError(caught instanceof ApiError ? caught.userMessage : copy.errors.unexpected);
          }
        }}
      >
        <FormError message={archiveError} />
      </ConfirmDialog>
    </>
  );
}
