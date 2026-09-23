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

import { Scale, type RatingValue } from './Scale';

/**
 * CLOSING THE DAY — one question, answered privately.
 *
 * Mutual respect and the quality of talking, 1–5, and an optional note. The
 * answer is felt before it is read: behind the scale there is one soft light,
 * and its colour follows the value — dusk at 1, dawn at 5. A low answer is
 * quiet and cool, never red; a high one is warm, never confetti.
 *
 * The light is a background colour on an element that never changes size, so
 * choosing moves nothing on the page. Nothing is pre-selected: a default of 3
 * would be an answer nobody gave, and it is the figure the summary rests on.
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
  const [missing, setMissing] = useState(false);

  async function save() {
    if (respect === null) {
      // Pressing reveals the problem; a disabled button that will not say why
      // wastes the press.
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

      <div className="relative isolate pt-8 pb-2">
        {/* The light. Fixed size, coloured by the answer. */}
        <span
          aria-hidden="true"
          data-tone={respect ?? undefined}
          className="tone-light pointer-events-none absolute inset-x-4 -inset-y-2 -z-10 rounded-full blur-3xl"
        />
        <Scale
          legend={copy.day.respectLabel}
          labels={copy.day.scale}
          value={respect}
          onChange={(next) => {
            setMissing(false);
            setRespect(next);
          }}
          size="lg"
          tone="ink"
          slot={
            missing ? (
              <motion.p
                role="alert"
                initial={reduced ? false : { opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-body font-medium text-danger-text"
              >
                {copy.day.chooseFirst}
              </motion.p>
            ) : undefined
          }
        />
      </div>

      <FormField label={copy.day.noteLabel} name="note" hint={copy.day.noteHint} error={fieldErrors.note}>
        {(props) => (
          <Textarea
            {...props}
            name="note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={copy.day.notePlaceholder}
          />
        )}
      </FormField>

      <Button variant="primary" onClick={save} loading={pending} className="min-h-12 w-full">
        {mode === 'submit' ? copy.day.submitAction : copy.common.save}
      </Button>
    </form>
  );
}
