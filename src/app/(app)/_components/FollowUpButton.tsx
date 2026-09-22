'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { Button } from '@/core/ui/components/Button';
import { RadioGroup } from '@/core/ui/components/Choice';
import { DateInput } from '@/core/ui/components/DateInput';
import { Dialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FlagIcon } from '@/core/ui/components/Icons';
import { FormError } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';

/**
 * Raise a manual follow-up on any record: "valid, but needs attention".
 * Kinds come from the domain (passed in), so this component stays generic.
 */
export function FollowUpButton({
  entityType,
  entityId,
  kinds,
}: {
  entityType: string;
  entityId: string;
  kinds: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState<CalendarDate | ''>('');
  const [dateInvalid, setDateInvalid] = useState(false);
  const { submit, pending, fieldErrors, formError, reset, clearOnInput } = useSubmit();

  function openDialog() {
    reset();
    setKind(null);
    setNote('');
    setDueDate('');
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (dateInvalid) return;
    const result = await submit('/api/follow-ups', {
      body: { entityType, entityId, kind: kind ?? '', note, dueDate: dueDate || null },
    });
    if (!result) return;
    setOpen(false);
    toast.show('פריט המעקב נפתח');
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={openDialog}>
        <FlagIcon className="size-4.5" />
        מעקב
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!pending}
        title="פתיחת פריט מעקב"
        description="הרשומה תקינה, אבל מישהו צריך לחזור אליה."
        footer={
          <div className="flex gap-2.5 sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending} className="flex-1 sm:flex-none">
              ביטול
            </Button>
            <Button type="submit" form="follow-up-form" variant="primary" loading={pending} className="flex-1 sm:flex-none">
              פתיחת מעקב
            </Button>
          </div>
        }
      >
        <form method="post" onInput={clearOnInput} id="follow-up-form" noValidate onSubmit={save} className="grid gap-4">
          <RadioGroup
            legend="מה צריך לעשות"
            name="kind"
            value={kind}
            onChange={setKind}
            options={Object.entries(kinds).map(([value, label]) => ({ value, label }))}
            error={fieldErrors.kind}
          />
          <FormField name="note" label="הערה" error={fieldErrors.note}>
            {(props) => <Textarea {...props} rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />}
          </FormField>
          <FormField name="dueDate" label="לטפל עד" error={fieldErrors.dueDate ?? (dateInvalid ? 'תאריך לא תקין. יש לכתוב בתבנית DD.MM.YYYY' : undefined)}>
            {(props) => <DateInput {...props} value={dueDate} onChange={setDueDate} onInvalidChange={setDateInvalid} />}
          </FormField>
          <FormError message={formError} />
        </form>
      </Dialog>
    </>
  );
}
