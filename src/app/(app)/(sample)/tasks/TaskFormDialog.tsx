'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CalendarDate } from '@/core/dates/calendar-date';
import type { Minor } from '@/core/money/money';
import { Button } from '@/core/ui/components/Button';
import { DateInput } from '@/core/ui/components/DateInput';
import { Dialog } from '@/core/ui/components/Dialog';
import { FormField, Input, Select, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { MoneyInput } from '@/core/ui/components/MoneyInput';
import { PlusIcon } from '@/core/ui/components/Icons';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { copy } from '@/core/copy';
import type { TaskView } from '@/domain/sample/tasks';

interface Props {
  open: boolean;
  onClose: () => void;
  task?: TaskView;
  customerId?: string;
  assignees?: Array<{ id: string; name: string }>;
  canPrice: boolean;
}

export function TaskFormDialog({ open, onClose, task, customerId, assignees, canPrice }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { submit, pending, fieldErrors, formError, reset, clearOnInput } = useSubmit();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<CalendarDate | ''>('');
  const [assigneeId, setAssigneeId] = useState('');
  const [price, setPrice] = useState<Minor | null>(null);
  const [dateInvalid, setDateInvalid] = useState(false);
  const [priceInvalid, setPriceInvalid] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Reload the form each time the dialog opens (render-phase adjustment, no effect).
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      reset();
      setClientErrors({});
      setTitle(task?.title ?? '');
      setDescription(task?.description ?? '');
      setDueDate(task?.dueDate ?? '');
      setAssigneeId(task?.assignee?.id ?? '');
      setPrice(task?.price?.net ?? null);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    // Client checks are for immediate feedback only; the server validates everything again.
    const problems: Record<string, string> = {};
    if (dateInvalid) problems.dueDate = copy.validation.invalidDate;
    if (priceInvalid) problems.priceAgorot = copy.validation.invalidMoney;
    setClientErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const body: Record<string, unknown> = { title, description, dueDate: dueDate || null };
    if (assignees) body.assigneeId = assigneeId || null;
    if (canPrice) body.priceAgorot = price;

    const result = task
      ? await submit<TaskView>(`/api/tasks/${task.id}`, { method: 'PATCH', body: { ...body, version: task.version } })
      : await submit<TaskView>('/api/tasks', { body: { ...body, customerId } });
    if (!result) return;
    onClose();
    toast.show(task ? 'המשימה נשמרה' : 'המשימה נוספה');
    router.refresh();
  }

  const errorsFor = (key: string) => clientErrors[key] ?? fieldErrors[key];
  const formId = task ? `task-form-${task.id}` : 'task-form-new';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title={task ? 'עריכת משימה' : 'משימה חדשה'}
      footer={
        <div className="flex gap-2.5 sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending} className="flex-1 sm:flex-none">
            ביטול
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={pending} className="flex-1 sm:flex-none">
            {task ? 'שמירה' : 'הוספת המשימה'}
          </Button>
        </div>
      }
    >
      <form method="post" onInput={clearOnInput} id={formId} noValidate onSubmit={save} className="grid gap-4">
        <FormField label="כותרת" required error={errorsFor('title')}>
          {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} autoComplete="off" />}
        </FormField>
        <FormField label="תיאור" error={errorsFor('description')}>
          {(props) => <Textarea {...props} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="תאריך יעד" error={errorsFor('dueDate')}>
            {(props) => <DateInput {...props} value={dueDate} onChange={setDueDate} onInvalidChange={setDateInvalid} />}
          </FormField>
          {assignees && (
            <FormField label="מבצע" error={errorsFor('assigneeId')}>
              {(props) => (
                <Select {...props} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                  <option value="">ללא מבצע</option>
                  {assignees.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}
        </div>
        {canPrice && (
          <FormField
            label="מחיר לפני מע״מ"
            error={errorsFor('priceAgorot')}
            hint={task?.price ? `שיעור המע״מ יישמר לפי ההגדרה הנוכחית אם המחיר ישתנה.` : 'שיעור המע״מ הנוכחי יישמר על המשימה.'}
          >
            {(props) => <MoneyInput {...props} value={price} onChange={setPrice} onInvalidChange={setPriceInvalid} />}
          </FormField>
        )}
        <FormError message={formError} />
      </form>
    </Dialog>
  );
}

export function NewTaskButton({
  customerId,
  assignees,
  canPrice,
}: {
  customerId: string;
  assignees?: Array<{ id: string; name: string }>;
  canPrice: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        משימה חדשה
      </Button>
      <TaskFormDialog open={open} onClose={() => setOpen(false)} customerId={customerId} assignees={assignees} canPrice={canPrice} />
    </>
  );
}
