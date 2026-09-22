'use client';

import { forwardRef, useEffect, useState } from 'react';
import { businessLocale } from '@/brand/brand';
import { parseMajorInput, toMajorInputString, type Minor } from '@/core/money/money';
import { Input, type InputProps } from './Field';

/**
 * A money amount typed in major units (₪), carried as integer minor units.
 *
 * Accepts "1180", "1,180", "1180.5". While typing, the text is left alone; on
 * blur a readable value is normalized ("1180.5" → "1180.50" stays exact). The
 * parent receives `null` while the text is empty or unreadable, and
 * `onInvalidChange` reports unreadable text so the form can block submit and
 * show a message. The server validates again: this is UX, not a guarantee.
 *
 * A minus sign is never silently dropped: without allowNegative, "-5" is
 * unreadable (null, aria-invalid), not 5 — a refund must not become a charge.
 *
 * Direction: amounts are LTR runs; the currency sign sits at the inline-start
 * of the LTR control (left), matching how "₪1,180" is written.
 */

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: Minor | null;
  onChange: (value: Minor | null) => void;
  onInvalidChange?: (invalid: boolean) => void;
  /** Accept negative amounts (refunds, credits, adjustments). */
  allowNegative?: boolean;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, onInvalidChange, onBlur, className, allowNegative = false, ...rest },
  ref,
) {
  const [text, setText] = useState(value === null ? '' : toMajorInputString(value));

  useEffect(() => {
    const current = text.trim() === '' ? null : parseMajorInput(text, { allowNegative });
    if (current !== value) setText(value === null ? '' : toMajorInputString(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adopt external value changes only
  }, [value]);

  const invalid = text.trim() !== '' && parseMajorInput(text, { allowNegative }) === null;
  useEffect(() => onInvalidChange?.(invalid), [invalid, onInvalidChange]);

  return (
    <div className="w-full max-w-[14rem]">
      <Input
        ref={ref}
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        aria-invalid={invalid || rest['aria-invalid'] === true ? true : undefined}
        leading={<span aria-hidden="true" className="text-body">{businessLocale.currencySymbol}</span>}
        className={`tnum text-start ${className ?? ''}`}
        value={text}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d.,₪-]/g, '');
          setText(next);
          onChange(next.trim() === '' ? null : parseMajorInput(next, { allowNegative }));
        }}
        onBlur={(event) => {
          const parsed = parseMajorInput(text, { allowNegative });
          if (parsed !== null) setText(toMajorInputString(parsed));
          onBlur?.(event);
        }}
      />
    </div>
  );
});
