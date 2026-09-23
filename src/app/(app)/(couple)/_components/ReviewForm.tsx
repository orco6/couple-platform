'use client';

import { useMotionValue } from 'motion/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useSubmit } from '@/core/ui/hooks/useSubmit';
import { FormError } from '@/core/ui/components/Layout';
import { cx } from '@/core/ui/cx';
import type { CalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';
import type { DayEntryValues } from '@/domain/day-entries/day-entries';

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
  const progress = useMotionValue(respect === null ? 0.5 : (respect - 1) / 4);

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
          'tap-quiet press mt-8 h-14 w-full max-w-sm rounded-full text-row font-semibold transition-[background-color,color,box-shadow] duration-300',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          // Quiet until there is an answer, then the one primary action — never
          // faded to a contrast nobody can read.
          respect === null
            ? 'bg-[var(--brand-glass-strong)] text-ink-muted shadow-[var(--brand-glass-edge)]'
            : 'bg-accent text-on-accent shadow-[var(--brand-shadow-float)]',
        )}
      >
        {mode === 'submit' ? copy.day.submitAction : copy.common.save}
      </button>
    </form>
  );
}
