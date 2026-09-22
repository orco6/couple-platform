'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest, ApiError } from '@/core/http/client';
import { Button } from '@/core/ui/components/Button';
import { ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { ArchiveIcon } from '@/core/ui/components/Icons';
import { FormError } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import type { CustomerView } from '@/domain/sample/customers';
import { CustomerFormDialog } from '../CustomerFormDialog';

export function CustomerActions({ customer, owners }: { customer: CustomerView; owners?: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {customer.permissions.edit && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          עריכה
        </Button>
      )}
      {customer.permissions.archive && (
        <Button
          variant="quiet"
          onClick={() => {
            setReason('');
            setError(null);
            setArchiving(true);
          }}
        >
          <ArchiveIcon className="size-4.5" />
          לארכיון
        </Button>
      )}

      <CustomerFormDialog open={editing} onClose={() => setEditing(false)} customer={customer} owners={customer.permissions.reassign ? owners : undefined} />

      <ConfirmDialog
        open={archiving}
        title={`העברת ${customer.name} לארכיון`}
        body="הלקוח יוסתר מהרשימות הפעילות. המשימות, ההערות וההיסטוריה שלו נשמרות, ואפשר לשחזר אותו מהארכיון."
        confirmLabel="העברה לארכיון"
        onCancel={() => setArchiving(false)}
        onConfirm={async () => {
          try {
            await apiRequest(`/api/customers/${customer.id}/archive`, { method: 'POST', body: { reason } });
            setArchiving(false);
            toast.show('הלקוח הועבר לארכיון');
            router.push('/customers');
            router.refresh();
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.userMessage : 'הפעולה נכשלה');
          }
        }}
      >
        <FormField label="סיבה (לא חובה)">
          {(props) => <Textarea {...props} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />}
        </FormField>
        <FormError message={error} />
      </ConfirmDialog>
    </>
  );
}
