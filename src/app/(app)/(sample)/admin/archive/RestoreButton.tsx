'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/core/ui/components/Button';
import { ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';

export function RestoreButton({ url, label }: { url: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { submit, fieldErrors, formError, reset, clearOnInput } = useSubmit();

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          reset();
          setReason('');
          setOpen(true);
        }}
      >
        שחזור
      </Button>
      <ConfirmDialog
        open={open}
        tone="default"
        title={`שחזור ${label}`}
        body="הרשומה תחזור לרשימות הפעילות."
        confirmLabel="שחזור"
        confirmDisabled={reason.trim().length < 3}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const result = await submit(url, { body: { reason } });
          if (!result) return;
          setOpen(false);
          toast.show('שוחזר מהארכיון');
          router.refresh();
        }}
      >
        <div onInput={clearOnInput}>
          <FormField name="reason" label="סיבה" required error={fieldErrors.reason}>
            {(props) => <Textarea {...props} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />}
          </FormField>
        </div>
        <FormError message={formError} />
      </ConfirmDialog>
    </>
  );
}
