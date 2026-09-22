'use client';

import { forwardRef, useEffect, useState } from 'react';
import { parseLocalTime, type LocalTime } from '@/core/dates/local-time';
import { cx } from '@/core/ui/cx';
import { Input, type InputProps } from './Field';

/**
 * A 24-hour wall-clock time, HH:MM, in the business timezone.
 *
 * A text field rather than <input type="time">: the native control renders
 * 12-hour AM/PM on many English-locale machines, which is wrong for an Israeli
 * business and ambiguous when typed. Strict: "9:5" and "25:00" are rejected;
 * "9:05" is accepted and shown as "09:05".
 *
 * The parent value always matches what is on screen: while the text is empty
 * or unreadable the parent receives '' (never the last valid time), and the
 * control is marked aria-invalid once the person leaves it.
 *
 * Combine with a DateInput value on the SERVER with `localToInstant` — never
 * build a Date in the browser (the browser's timezone is not the business's).
 */

export interface TimeInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: LocalTime | '';
  onChange: (value: LocalTime | '') => void;
  onInvalidChange?: (invalid: boolean) => void;
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
  { value, onChange, onInvalidChange, onBlur, className, ...rest },
  ref,
) {
  const [text, setText] = useState<string>(value);
  const [touched, setTouched] = useState(false);

  // Adopt external changes (reset, edit another record) without fighting typing.
  const [adopted, setAdopted] = useState(value);
  if (value !== adopted) {
    setAdopted(value);
    if ((parseLocalTime(text) ?? '') !== value) setText(value);
  }

  const parsed = text.trim() === '' ? '' : parseLocalTime(text);
  const invalid = parsed === null;
  useEffect(() => onInvalidChange?.(invalid), [invalid, onInvalidChange]);

  return (
    <div className="w-[6.5rem]">
      <Input
        ref={ref}
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:MM"
        maxLength={5}
        dir="ltr"
        aria-invalid={(touched && invalid) || rest['aria-invalid'] === true ? true : undefined}
        className={cx('tnum text-start', className)}
        value={text}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d:]/g, '');
          setText(next);
          onChange(next.trim() === '' ? '' : (parseLocalTime(next) ?? ''));
        }}
        onBlur={(event) => {
          setTouched(true);
          if (parsed) setText(parsed);
          onBlur?.(event);
        }}
      />
    </div>
  );
});
