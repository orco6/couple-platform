'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest, ApiError } from '@/core/http/client';
import { Button } from '@/core/ui/components/Button';
import { ConfirmDialog } from '@/core/ui/components/Dialog';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { DateTimeText } from '@/core/ui/components/Text';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { NoteView } from '@/domain/sample/notes';

export function NotesPanel({ customerId, notes, canAdd }: { customerId: string; notes: NoteView[]; canAdd: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [deleting, setDeleting] = useState<NoteView | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { submit, pending, fieldErrors, formError, clearOnInput } = useSubmit();

  return (
    <div className="grid gap-4">
      {canAdd && (
        <form method="post" onInput={clearOnInput}
          noValidate
          className="grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await submit(`/api/customers/${customerId}/notes`, { body: { body } });
            if (!result) return;
            setBody('');
            router.refresh();
          }}
        >
          <FormField name="body" label="הערה חדשה" hideLabel error={fieldErrors.body}>
            {(props) => (
              <Textarea {...props} rows={2} placeholder="הערה חדשה…" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} />
            )}
          </FormField>
          <FormError message={formError} />
          <div>
            <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={body.trim() === ''}>
              הוספת הערה
            </Button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-body text-ink-subtle">אין הערות.</p>
      ) : (
        <ul className="divide-y divide-rule-faint border-y border-rule-faint">
          {notes.map((note) => (
            <li key={note.id} className="py-3">
              <p className="whitespace-pre-wrap break-words text-body text-ink">{note.body}</p>
              <div className="mt-1 flex items-center gap-2 text-meta text-ink-subtle">
                <span>{note.authorName}</span>
                <span aria-hidden="true">·</span>
                <DateTimeText value={note.createdAt} />
                {note.canDelete && (
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(note);
                    }}
                    // Not restorable from the UI: danger text (reversible removals like archive stay neutral).
                    // 44px tall on phones, compact beside the metadata on desktop.
                    className="ms-auto min-h-11 text-danger-text sm:min-h-9"
                  >
                    מחיקה
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="מחיקת הערה"
        body="ההערה תוסר מהרשימה. היא נשמרת ביומן הפעולות."
        confirmLabel="מחיקה"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await apiRequest(`/api/notes/${deleting.id}`, { method: 'DELETE' });
            setDeleting(null);
            toast.show('ההערה נמחקה');
            router.refresh();
          } catch (caught) {
            setDeleteError(caught instanceof ApiError ? caught.userMessage : 'הפעולה נכשלה');
          }
        }}
      >
        <FormError message={deleteError} />
      </ConfirmDialog>
    </div>
  );
}
