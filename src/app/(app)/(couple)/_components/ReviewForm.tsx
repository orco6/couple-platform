'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { FormError } from '@/core/ui/components/Layout';
import { cx } from '@/core/ui/cx';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';
import type { DayEntryValues } from '@/domain/day-entries/day-entries';

import { Orbs, type RatingValue } from './Orbs';

/**
 * CLOSING THE DAY — one question, and the room answers.
 *
 * Five lights from dusk to dawn. Choosing one re-lights the whole screen in
 * its colour (a crossfade between five fixed layers — opacity only), so a
 * low answer is a quiet blue evening and a high one a warm morning; never a
 * red alarm, never confetti. The note is one quiet line, optional. The button
 * appears once there is an answer; its space is reserved, so nothing moves.
 *
 * Nothing is pre-selected: a default of 3 would be an answer nobody gave.
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
  const { submit, pending, fieldErrors, formError } = useSubmit();
  const [respect, setRespect] = useState<RatingValue | null>((existing?.respectRating as RatingValue | undefined) ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [missing, setMissing] = useState(false);

  async function save() {
    if (respect === null) {
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
    <form method="post" onSubmit={(event) => event.preventDefault()} className="flex flex-col items-center">
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} aria-hidden="true" data-on={respect === step} className={`mood-layer mood-${step}`} />
      ))}

      <FormError message={formError} />

      <div className="w-full">
        <Orbs
          legend={copy.day.respectLabel}
          labels={copy.day.scale}
          value={respect}
          tone="day"
          size="lg"
          onChange={(next) => {
            setMissing(false);
            setRespect(next);
          }}
        />
      </div>

      <div className="mt-1 h-6">
        {missing && (
          <p role="alert" className="text-body font-medium text-danger-text">
            {copy.day.chooseFirst}
          </p>
        )}
      </div>

      <label htmlFor="day-note" className="sr-only">
        {copy.day.noteLabel}
      </label>
      <textarea
        id="day-note"
        name="note"
        rows={1}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={copy.day.notePlaceholder}
        aria-invalid={fieldErrors.note ? true : undefined}
        className="mt-6 min-h-12 w-full max-w-sm resize-none rounded-[1.25rem] bg-[var(--brand-glass)] px-4 py-3 text-center text-row text-ink shadow-[var(--brand-glass-edge)] backdrop-blur-md outline-none placeholder:text-ink-subtle focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
      />
      {fieldErrors.note && <p className="mt-1 text-label text-danger-text">{fieldErrors.note}</p>}

      <button
        type="button"
        onClick={save}
        aria-busy={pending || undefined}
        className={cx(
          'tap-quiet press mt-8 h-14 w-full max-w-sm rounded-full bg-accent text-row font-semibold text-on-accent shadow-[var(--brand-shadow-float)] transition-opacity duration-300',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          respect === null && 'opacity-40',
        )}
      >
        {mode === 'submit' ? copy.day.submitAction : copy.common.save}
      </button>
    </form>
  );
}
