'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/core/ui/components/Dialog';
import { Button } from '@/core/ui/components/Button';
import { FormError } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';

export function SignOutEverywhere() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { submit, formError } = useSubmit();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        ניתוק מכל המכשירים האחרים
      </Button>
      <ConfirmDialog
        open={open}
        tone="default"
        title="ניתוק מכל המכשירים האחרים"
        body="כל חיבור אחר לחשבון יסתיים מיד. החיבור הנוכחי נשאר."
        confirmLabel="ניתוק"
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const result = await submit<{ ended: number }>('/api/auth/sessions', { method: 'DELETE' });
          if (!result) return;
          setOpen(false);
          toast.show(result.ended === 0 ? 'לא היו חיבורים אחרים' : `נותקו ${result.ended} חיבורים`);
        }}
      >
        <FormError message={formError} />
      </ConfirmDialog>
    </>
  );
}
