'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { copy } from '@/core/copy';
import { formatCalendarDate, parseIsoDate, parseIsraeliDate, type CalendarDate } from '@/core/dates/calendar-date';
import { cx } from '@/core/ui/cx';
import { Input, type InputProps } from './Field';
import { CalendarIcon } from './Icons';

/**
 * A business date, typed as DD.MM.YYYY or picked from a calendar.
 *
 * Why not a visible <input type="date">: its segments follow the BROWSER's
 * locale, not the page's. On an English Windows machine it shows MM/DD/YYYY
 * inside a Hebrew form, and 01.10 silently becomes the 10th of January. So the
 * visible field is text with a fixed day-first order and strict parsing
 * (31.04.2026 is refused, never rolled into May).
 *
 * The calendar button opens a hidden native date input via showPicker(): the
 * popup is a month grid with named months, which no locale can misorder.
 *
 * Value in and out is ISO "YYYY-MM-DD" (or "" for empty). Invalid text is
 * reported on blur, never while typing — "01.1" is a correct date half-typed.
 */

export interface DateInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: CalendarDate | '';
  onChange: (value: CalendarDate | '') => void;
  /** Called with true while the visible text cannot be read as a date. */
  onInvalidChange?: (invalid: boolean) => void;
  min?: CalendarDate;
  max?: CalendarDate;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onChange, onInvalidChange, onBlur, min, max, className, ...rest },
  ref,
) {
  const [text, setText] = useState(value ? formatCalendarDate(value) : '');
  const [touched, setTouched] = useState(false);
  const [hasPicker, setHasPicker] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHasPicker('showPicker' in HTMLInputElement.prototype), []);

  // Adopt a value set from outside (reset, edit another record) without fighting typing.
  // Unreadable text reports '' to the parent, so '' coming back is our own echo, not a reset.
  useEffect(() => {
    const onScreen = text.trim() === '' ? '' : (parseIsraeliDate(text) ?? '');
    if (onScreen !== (value || '')) {
      setText(value ? formatCalendarDate(value) : '');
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by the incoming value only
  }, [value]);

  const parsed = text.trim() === '' ? '' : parseIsraeliDate(text);
  const outOfRange = parsed ? (min !== undefined && parsed < min) || (max !== undefined && parsed > max) : false;
  const invalid = parsed === null || outOfRange;

  useEffect(() => onInvalidChange?.(invalid), [invalid, onInvalidChange]);

  const describedError = touched && invalid;

  return (
    <div className="flex items-center gap-2">
      <div className="w-[9.5rem]">
        <Input
          ref={ref}
          {...rest}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD.MM.YYYY"
          maxLength={10}
          value={text}
          invalid={describedError || rest['aria-invalid'] === true}
          dir="ltr"
          className={cx('tnum text-start', className)}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d./-]/g, '');
            setText(next);
            // The parent always holds what is on screen: unreadable text is '' (never the previous date).
            onChange(next.trim() === '' ? '' : (parseIsraeliDate(next) ?? ''));
          }}
          onBlur={(event) => {
            setTouched(true);
            if (parsed) setText(formatCalendarDate(parsed));
            onBlur?.(event);
          }}
        />
      </div>
      {hasPicker && (
        <span className="relative inline-flex">
          <button
            type="button"
            tabIndex={-1}
            aria-label={copy.common.openCalendar}
            onClick={() => {
              try {
                pickerRef.current?.showPicker();
              } catch {
                // Some embedded browsers refuse; typing still works.
              }
            }}
            className="flex size-11 items-center justify-center rounded-control border border-rule-strong bg-surface text-ink-muted hover:bg-hover hover:text-ink"
          >
            <CalendarIcon />
          </button>
          <input
            ref={pickerRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            min={min}
            max={max}
            value={parsed || ''}
            onChange={(event) => {
              const iso = parseIsoDate(event.target.value);
              setText(iso ? formatCalendarDate(iso) : '');
              setTouched(false);
              onChange(iso ?? '');
            }}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        </span>
      )}
    </div>
  );
});
