'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/core/ui/components/Button';
import { Dialog } from '@/core/ui/components/Dialog';
import { FormField, Input, Select } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { CustomerView } from '@/domain/sample/customers';

interface Props {
  open: boolean;
  onClose: () => void;
  customer?: CustomerView;
  /** Present only when the viewer may assign an owner other than themselves. */
  owners?: Array<{ id: string; name: string }>;
}

export function CustomerFormDialog({ open, onClose, customer, owners }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { submit, pending, fieldErrors, formError, reset, clearOnInput } = useSubmit();
  const [values, setValues] = useState({ name: '', phone: '', email: '', city: '', ownerId: '' });

  // Reload the form each time the dialog opens (render-phase adjustment, no effect).
  const [openedFor, setOpenedFor] = useState<boolean>(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      reset();
      setValues({
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      city: customer?.city ?? '',
      ownerId: customer?.owner.id ?? '',
      });
    }
  }

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const body: Record<string, unknown> = { name: values.name, phone: values.phone, email: values.email, city: values.city };
    if (owners && values.ownerId) body.ownerId = values.ownerId;
    const result = await submit<CustomerView>(customer ? `/api/customers/${customer.id}` : '/api/customers', {
      method: customer ? 'PATCH' : 'POST',
      body,
    });
    if (!result) return;
    onClose();
    toast.show(customer ? 'פרטי הלקוח נשמרו' : 'הלקוח נוסף');
    if (customer) router.refresh();
    else router.push(`/customers/${result.id}`);
  }

  const formId = customer ? `customer-form-${customer.id}` : 'customer-form-new';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title={customer ? 'עריכת לקוח' : 'לקוח חדש'}
      footer={
        <div className="flex gap-2.5 sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending} className="flex-1 sm:flex-none">
            ביטול
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={pending} className="flex-1 sm:flex-none">
            {customer ? 'שמירה' : 'הוספת הלקוח'}
          </Button>
        </div>
      }
    >
      <form method="post" onInput={clearOnInput} id={formId} noValidate onSubmit={save} className="grid gap-4">
        <FormField name="name" label="שם הלקוח" required error={fieldErrors.name}>
          {(props) => <Input {...props} value={values.name} onChange={set('name')} autoComplete="off" maxLength={120} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="phone" label="טלפון" error={fieldErrors.phone}>
            {(props) => (
              <Input {...props} type="tel" inputMode="tel" dir="ltr" className="text-start" value={values.phone} onChange={set('phone')} autoComplete="off" />
            )}
          </FormField>
          <FormField name="city" label="עיר" error={fieldErrors.city}>
            {(props) => <Input {...props} value={values.city} onChange={set('city')} autoComplete="off" maxLength={80} />}
          </FormField>
        </div>
        <FormField name="email" label="דוא״ל" error={fieldErrors.email}>
          {(props) => (
            <Input {...props} type="email" inputMode="email" dir="ltr" className="text-start" value={values.email} onChange={set('email')} autoComplete="off" />
          )}
        </FormField>
        {owners && (
          <FormField name="ownerId" label="אחראי" error={fieldErrors.ownerId} hint="ללא בחירה, הלקוח ישויך אליך.">
            {(props) => (
              <Select {...props} value={values.ownerId} onChange={set('ownerId')}>
                <option value="">{customer ? customer.owner.name : 'אני'}</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
        <FormError message={formError} />
      </form>
    </Dialog>
  );
}

export function NewCustomerButton({ owners }: { owners?: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        לקוח חדש
      </Button>
      <CustomerFormDialog open={open} onClose={() => setOpen(false)} owners={owners} />
    </>
  );
}
