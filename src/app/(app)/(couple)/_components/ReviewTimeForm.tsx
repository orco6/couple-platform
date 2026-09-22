'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { FormField } from '@/core/ui/components/Field';
import { FormError, Notice } from '@/core/ui/components/Layout';
import { TimeInput } from '@/core/ui/components/TimeInput';
import { useToast } from '@/core/ui/components/Toast';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { LocalTime } from '@/core/dates/local-time';
import { copy } from '@/domain/copy';

/**
 * THE ONE SETTING — the hour from which the day can be closed.
 *
 * Read-only for the partner who does not hold `settings.manage` (R-SET-02): a
 * shared ritual time that either person can move silently is a trust problem,
 * so the other partner sees the time and who changes it rather than a control
 * that would be refused.
 */
export function ReviewTimeForm({ value, canManage }: { value: LocalTime; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { submit, pending, fieldErrors, formError, clearOnInput } = useSubmit();

  const [time, setTime] = useState<LocalTime | ''>(value);
  const [invalid, setInvalid] = useState(false);
  /** Only ever set by pressing save with an unreadable time. */
  const [showInvalid, setShowInvalid] = useState(false);

  if (!canManage) {
    return (
      <div className="card p-4">
        <p className="text-label font-semibold text-ink-muted">{copy.settings.reviewTimeLabel}</p>
        <p className="mt-2 text-[1.75rem] leading-none font-semibold tabular-nums text-ink" dir="ltr">
          {value}
        </p>
        <p className="mt-3 text-meta text-ink-subtle">{copy.settings.reviewTimeReadOnly}</p>
      </div>
    );
  }

  async function save() {
    if (invalid || time === '') {
      // Never a disabled button that will not say why.
      setShowInvalid(true);
      return;
    }
    setShowInvalid(false);
    const result = await submit('/api/review-time', { method: 'PUT', body: { time } });
    if (result === null) return;
    toast.show(copy.settings.reviewTimeSaved);
    router.refresh();
  }

  return (
    <form
      method="post"
      onInput={clearOnInput}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="card flex flex-col gap-4 p-4"
    >
      <FormError message={formError} />

      <FormField
        label={copy.settings.reviewTimeLabel}
        name="time"
        hint={copy.settings.reviewTimeDescription}
        error={fieldErrors.time ?? (showInvalid ? copy.settings.reviewTimeLabel : undefined)}
      >
        {(props) => (
          <TimeInput {...props} value={time} onChange={setTime} onInvalidChange={setInvalid} />
        )}
      </FormField>

      {value !== time && time !== '' && !invalid && (
        <Notice>{copy.settings.reviewTimeDescription}</Notice>
      )}

      <Button type="submit" variant="primary" loading={pending} className="sm:self-start">
        {copy.common.save}
      </Button>
    </form>
  );
}
