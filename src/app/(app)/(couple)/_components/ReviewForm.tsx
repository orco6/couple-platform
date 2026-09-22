'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/core/ui/components/Button';
import { FormField, Textarea } from '@/core/ui/components/Field';
import { FormError } from '@/core/ui/components/Layout';
import { useSubmit } from '@/core/ui/hooks/useSubmit';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';
import type { DayEntryValues } from '@/domain/day-entries/day-entries';

import { Stars, type RatingValue } from './Stars';

/**
 * CLOSING THE DAY — one question.
 *
 * Mutual respect and communication, 1–5, plus an optional note. Task execution
 * is rated per task by the other partner, so a second daily question would be
 * the same thing asked twice with a worse denominator.
 *
 * The screen responds to the value as it changes: the card behind the stars
 * warms from cool to warm across the five steps, so the answer is felt before
 * it is read. That gradient is driven from the value only — it is not
 * decoration, it is the feedback.
 *
 * Nothing is pre-selected. A default of 3 would be an answer nobody gave, and
 * the figure it feeds is the one the whole summary rests on.
 */
export function ReviewForm({
  date,
  existing,
  mode,
}: {
  date: CalendarDate;
  existing?: DayEntryValues | null;
  mode: 'submit' | 'amend';
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { submit, pending, fieldErrors, formError } = useSubmit();

  const [respect, setRespect] = useState<RatingValue | null>((existing?.respectRating as RatingValue | undefined) ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  /** Only ever set by pressing submit with nothing chosen. */
  const [missing, setMissing] = useState(false);

  async function save() {
    if (respect === null) {
      // Not a disabled button: the foundation's rule is that pressing reveals
      // the problem, because a disabled control that will not say why wastes
      // the press. Extraction record — "Submit never disabled for invalid
      // input".
      setMissing(true);
      return;
    }
    setMissing(false);
    const body = { entryDate: date, respectRating: respect, note: note.trim() === '' ? null : note };

    const result =
      mode === 'submit'
        ? await submit('/api/day-entries', { method: 'POST', body })
        : await submit('/api/day-entries', { method: 'PATCH', body });

    if (result === null) return;
    router.refresh();
  }

  return (
    <form method="post" onSubmit={(event) => event.preventDefault()} className="space-y-6">
      <FormError message={formError} />

      <div className="card relative overflow-hidden p-6">
        {/* The response. Cool at 1, warm at 5, and it moves with the value
            rather than appearing after it. */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 h-56 rounded-full blur-3xl"
          initial={false}
          animate={{
            opacity: respect === null ? 0 : 0.28 + (respect - 1) * 0.11,
            backgroundColor:
              respect === null
                ? 'transparent'
                : respect <= 2
                  ? 'var(--brand-partner-b)'
                  : respect === 3
                    ? 'var(--brand-accent)'
                    : 'var(--brand-partner-a)',
          }}
          transition={reduced ? { duration: 0.12 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />

        <div className="relative">
          <p className="mb-1 text-center text-label font-semibold text-ink-muted">{copy.day.respectLabel}</p>
          <p className="mb-5 text-center text-body text-ink-subtle">{copy.day.respectQuestion}</p>

          <Stars
            legend={copy.day.respectLabel}
            labels={copy.day.scale}
            value={respect}
            onChange={(next) => {
              setMissing(false);
              setRespect(next);
            }}
            size={52}
            tone="accent"
          />

          {missing && (
            <p role="alert" className="mt-1 text-center text-body font-medium text-danger-text">
              {copy.day.chooseFirst}
            </p>
          )}
        </div>
      </div>

      <FormField label={copy.day.noteLabel} name="note" hint={copy.day.noteHint} error={fieldErrors.note}>
        {(props) => (
          <Textarea
            {...props}
            name="note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={copy.day.notePlaceholder}
          />
        )}
      </FormField>

      {/* Disabled only because nothing has been chosen yet, with the reason
          visible right above it — the foundation's rule is that a disabled
          control always says why. */}
      <Button
        variant="primary"
        onClick={save}
        loading={pending}
        className={respect === null ? 'w-full' : 'glow-accent w-full'}
      >
        {mode === 'submit' ? copy.day.submitAction : copy.common.save}
      </Button>
    </form>
  );
}
