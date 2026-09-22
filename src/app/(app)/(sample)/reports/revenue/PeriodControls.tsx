'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/core/ui/components/Button';
import { ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';

export function PeriodControls({
  periodKey,
  periodLabel,
  isClosed,
  unpricedCount,
}: {
  periodKey: string;
  periodLabel: string;
  isClosed: boolean;
  unpricedCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { submit, formError, fieldErrors, reset, clearOnInput } = useSubmit();

  return (
    <>
      <Button
        variant={isClosed ? 'secondary' : 'primary'}
        onClick={() => {
          reset();
          setReason('');
          setOpen(true);
        }}
      >
        {isClosed ? 'פתיחה מחדש' : `סגירת ${periodLabel}`}
      </Button>

      <ConfirmDialog
        open={open}
        tone={isClosed ? 'danger' : 'default'}
        title={isClosed ? `פתיחה מחדש של ${periodLabel}` : `סגירת ${periodLabel}`}
        body={
          isClosed
            ? 'פתיחה מחדש מאפשרת שוב לשנות משימות שנספרו בחודש. תמונת המצב הקודמת נשמרת, והפעולה נרשמת ביומן עם הסיבה.'
            : unpricedCount > 0
              ? `יש ${unpricedCount} משימות שבוצעו ללא מחיר — הן לא ייספרו בסכומים. אחרי הסגירה, שינוי שלהן יחייב פתיחה מחדש.`
              : 'הסכומים יישמרו כפי שהם עכשיו. אחרי הסגירה, שינוי משימות שבוצעו בחודש יחייב פתיחה מחדש.'
        }
        confirmLabel={isClosed ? 'פתיחה מחדש' : 'סגירת החודש'}
        confirmDisabled={isClosed && reason.trim().length < 3}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const result = await submit(`/api/reports/revenue/${periodKey}/${isClosed ? 'reopen' : 'close'}`, {
            body: isClosed ? { reason } : {},
          });
          if (!result) return;
          setOpen(false);
          toast.show(isClosed ? 'החודש נפתח מחדש' : 'החודש נסגר');
          router.refresh();
        }}
      >
        {isClosed && (
          <div onInput={clearOnInput}>
            <FormField name="reason" label="סיבה" required error={fieldErrors.reason}>
              {(props) => <Textarea {...props} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />}
            </FormField>
          </div>
        )}
        <FormError message={formError} />
      </ConfirmDialog>
    </>
  );
}
