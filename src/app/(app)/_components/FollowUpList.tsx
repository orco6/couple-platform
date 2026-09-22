'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FollowUpView } from '@/core/follow-ups/follow-ups';
import { Button } from '@/core/ui/components/Button';
import { Dialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { DateText } from '@/core/ui/components/Text';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';

export function FollowUpList({
  items,
  kinds,
  hrefFor,
}: {
  items: FollowUpView[];
  kinds: Record<string, string>;
  hrefFor?: Record<string, string | null>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [closing, setClosing] = useState<FollowUpView | null>(null);
  const [resolution, setResolution] = useState('');
  const { submit, pending, formError, fieldErrors, reset, clearOnInput } = useSubmit();

  async function close(outcome: 'RESOLVED' | 'DISMISSED') {
    if (!closing) return;
    const result = await submit(`/api/follow-ups/${closing.id}`, { body: { outcome, resolution } });
    if (!result) return;
    setClosing(null);
    toast.show(outcome === 'RESOLVED' ? 'סומן כטופל' : 'פריט המעקב בוטל');
    router.refresh();
  }

  return (
    <>
      <ul className="surface divide-y divide-rule-faint">
        {items.map((item) => {
          const href = hrefFor?.[item.id];
          return (
            <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-row font-medium text-ink">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {kinds[item.kind] ?? item.kind}
                    </Link>
                  ) : (
                    (kinds[item.kind] ?? item.kind)
                  )}
                </p>
                {item.note && <p className="mt-0.5 whitespace-pre-wrap text-body text-ink-muted">{item.note}</p>}
                <p className="mt-0.5 text-meta text-ink-subtle">
                  {item.assigneeName ? `אצל ${item.assigneeName}` : ''}
                  {item.dueDate && (
                    <>
                      {' · עד '}
                      <DateText value={item.dueDate} />
                    </>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  reset();
                  setResolution('');
                  setClosing(item);
                }}
              >
                טיפול
              </Button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={closing !== null}
        onClose={() => setClosing(null)}
        dismissible={!pending}
        size="sm"
        title="סגירת פריט מעקב"
        description={closing ? (kinds[closing.kind] ?? closing.kind) : undefined}
        footer={
          <div className="flex flex-wrap gap-2.5 sm:justify-end">
            <Button variant="secondary" onClick={() => close('DISMISSED')} disabled={pending} className="flex-1 sm:flex-none">
              ביטול הפריט
            </Button>
            <Button variant="primary" onClick={() => close('RESOLVED')} loading={pending} className="flex-1 sm:flex-none">
              סימון כטופל
            </Button>
          </div>
        }
      >
        <div className="grid gap-3" onInput={clearOnInput}>
          <FormField name="resolution" label="מה נעשה (לא חובה)" error={fieldErrors.resolution}>
            {(props) => <Textarea {...props} rows={3} value={resolution} onChange={(event) => setResolution(event.target.value)} maxLength={1000} />}
          </FormField>
          <FormError message={formError} />
        </div>
      </Dialog>
    </>
  );
}
