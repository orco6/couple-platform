'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { FormField, Select } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { copy } from '@/domain/copy';
import type { PartnershipView } from '@/domain/partners';

import { PartnerMark } from './PartnerMark';

/**
 * WHO THE COUPLE IS.
 *
 * The link is the privacy boundary for everything in this product, so the
 * screen shows it as a fact — two marks and two names — rather than as a
 * settings row. Only the owner may change it (`users.manage`); for the other
 * partner this is a statement, which is the honest shape for something they
 * cannot edit.
 */
export function PartnerLinkForm({
  partnership,
  linkable,
}: {
  partnership: PartnershipView;
  linkable: Array<{ id: string; name: string; username: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const { submit, pending, fieldErrors, formError } = useSubmit();
  const [partnerId, setPartnerId] = useState('');
  const [missing, setMissing] = useState(false);

  const { partnerA, partnerB } = partnership;

  async function link() {
    if (partnerId === '') {
      setMissing(true);
      return;
    }
    setMissing(false);
    const result = await submit('/api/partnership', { method: 'POST', body: { partnerId } });
    if (result === null) return;
    toast.show(copy.settings.partnerSaved);
    router.refresh();
  }

  return (
    <div className="card flex flex-col gap-4 p-4">
      {partnership.linked && partnerA && partnerB ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <PartnerMark partner={{ initial: Array.from(partnerA.name)[0] ?? '?', side: 'a' }} size={30} />
            <PartnerMark partner={{ initial: Array.from(partnerB.name)[0] ?? '?', side: 'b' }} size={30} />
          </span>
          <p className="text-row font-medium text-ink">{copy.settings.partnerBoth(partnerA.name, partnerB.name)}</p>
        </div>
      ) : (
        <p className="text-body text-ink-muted">{copy.settings.partnerNone}</p>
      )}

      {partnership.canManage && (
        <form
          method="post"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void link();
          }}
          className="flex flex-col gap-3 border-t border-rule-faint pt-4"
        >
          <FormError message={formError} />

          {linkable.length === 0 ? (
            <p className="text-meta text-ink-subtle">{copy.settings.noLinkableUsers}</p>
          ) : (
            <>
              <FormField
                label={copy.settings.partnerLabel}
                name="partnerId"
                hint={copy.settings.partnerLinkHint}
                error={fieldErrors.partnerId ?? (missing ? copy.settings.partnerLabel : undefined)}
              >
                {(props) => (
                  <Select {...props} value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
                    <option value="">—</option>
                    {linkable.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <Button type="submit" variant="secondary" loading={pending} className="sm:self-start">
                {copy.settings.partnerLinkAction}
              </Button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
