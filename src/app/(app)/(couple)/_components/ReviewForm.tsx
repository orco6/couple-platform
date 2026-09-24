'use client';

import { useMotionValue } from 'motion/react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { FormError } from '@/core/ui/components/Layout';
import { cx } from '@/core/ui/cx';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';
import type { DayEntryValues } from '@/domain/day-entries/day-entries';

import { BusyLabel } from './CoupleLoader';
import { GrowingTextarea } from './GrowingTextarea';
import { Moods } from './Moods';
import { Slider, type RatingValue } from './Slider';

/**
 * CLOSING THE DAY — one question, and the room answers.
 *
 * The same slider as a task's rating, larger. As the finger moves, the whole
 * room re-lights continuously (five fixed colour fields whose weights follow
 * the finger — opacity only): 1 is a quiet blue dusk, 3 a balanced warmth,
 * 5 an open warm morning. Never a red alarm, never confetti. The word says
 * where you are. Letting go does not close the day — the button does, so an
 * answer can be felt out first.
 *
 * Nothing is pre-selected: a default of 3 would be an answer nobody gave.
 */
export function ReviewForm({ date, existing, mode }: { date: CalendarDate; existing?: DayEntryValues | null; mode: 'submit' | 'amend' }) {
  const router = useRouter();
  const { submit, pending, fieldErrors, formError } = useSubmit();
  const [respect, setRespect] = useState<RatingValue | null>((existing?.respectRating as RatingValue | undefined) ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [missing, setMissing] = useState(false);
  const progress = useMotionValue(respect === null ? 0.5 : (respect - 1) / 4);
  // Busy until the next screen (the reveal, or the waiting) has arrived — not
  // only until the server said yes — so the button never pops back to idle.
  const [refreshing, startRefresh] = useTransition();
  const busy = pending || refreshing;

  async function save() {
    if (busy) return;
    if (respect === null) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const body = {
      entryDate: date,
      respectRating: respect,
      note: note.trim() === '' ? null : note,
    };
    const result =
      mode === 'submit'
        ? await submit('/api/day-entries', { method: 'POST', body })
        : await submit('/api/day-entries', { method: 'PATCH', body });
    if (result === null) return;
    startRefresh(() => router.refresh());
  }

  return (
    <form method="post" onSubmit={(event) => event.preventDefault()} className="flex flex-col items-center">
      <Moods progress={progress} on={respect !== null} />

      <FormError message={formError} />

      <div className="w-full">
        <Slider
          label={copy.day.respectLabel}
          labels={copy.day.scale}
          hint={copy.taskRating.hint}
          value={respect}
          size="lg"
          progress={progress}
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
      {/* Grows with what is written, line by line, so every word stays in view. */}
      <div className="mt-6 w-full max-w-sm">
        <GrowingTextarea
          id="day-note"
          name="note"
          rows={1}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={copy.day.notePlaceholder}
          aria-invalid={fieldErrors.note ? true : undefined}
          maxHeight={0.34}
          className="block min-h-12 w-full rounded-[1.25rem] bg-[var(--brand-glass)] px-4 py-3 text-center text-row leading-snug text-ink shadow-[var(--brand-glass-edge)] backdrop-blur-md outline-none [overflow-wrap:anywhere] placeholder:text-ink-subtle focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
        />
      </div>
      {fieldErrors.note && <p className="mt-1 text-label text-danger-text">{fieldErrors.note}</p>}

      <button
        type="button"
        onClick={save}
        aria-busy={busy || undefined}
        className={cx(
          'tap-quiet press mt-8 h-14 w-full max-w-sm rounded-full text-row font-semibold transition-[background-color,color,box-shadow] duration-300',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          // Quiet until there is an answer, then the one primary action — never
          // faded to a contrast nobody can read.
          respect === null
            ? 'bg-[var(--brand-glass-strong)] text-ink-muted shadow-[var(--brand-glass-edge)]'
            : 'bg-accent text-on-accent shadow-[var(--brand-shadow-float)]',
        )}
      >
        <BusyLabel busy={busy} onFill={respect !== null}>
          {mode === 'submit' ? copy.day.submitAction : copy.common.save}
        </BusyLabel>
      </button>
    </form>
  );
}
