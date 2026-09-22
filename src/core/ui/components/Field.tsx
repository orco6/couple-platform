'use client';

import { forwardRef, useId, type ReactNode } from 'react';
import { copy } from '@/core/copy';
import { cx } from '@/core/ui/cx';

/**
 * Form field primitives.
 *
 * `FormField` owns the label, hint, error and every aria relationship; the
 * control inside receives ids through a render prop, so any control — native
 * or composite — is labelled the same way:
 *
 *   <form method="post" onInput={clearOnInput} …>
 *     <FormField label="שם" name="name" required error={fieldErrors.name}>
 *       {(props) => <Input {...props} value={name} onChange={…} autoComplete="name" />}
 *     </FormField>
 *
 * `name` is the request field the server reports errors under. It is passed to
 * the control, so `useSubmit().clearOnInput` can remove that field's server error
 * the moment the person edits it (instead of leaving "required" on screen while
 * they are fixing it), and autocomplete has a meaningful name.
 *
 * RTL: controls inherit the page direction. A control whose CONTENT is Latin
 * (username, email, phone, amount) sets `dir="ltr"` on itself; the wrapper
 * carries the same `dir` so a trailing adornment and the reserved padding
 * resolve to the same physical side (the Koma bug where a checkmark sat on top
 * of a username came from those two disagreeing).
 */

export interface FieldControlProps {
  id: string;
  name?: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
}

export interface FormFieldProps {
  label: string;
  /** The request field name (and the server's error key). */
  name?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Visually hide the label (it stays for screen readers). Use sparingly. */
  hideLabel?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}

export function FormField({ label, name, hint, error, required, hideLabel, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cx('min-w-0', className)}>
      <div className={cx('mb-1.5 flex items-baseline gap-1', hideLabel && 'sr-only')}>
        <label htmlFor={id} className="text-label font-semibold text-ink-muted">
          {label}
        </label>
        {required && (
          <span className="text-label text-ink-subtle" aria-hidden="true" title={copy.common.requiredMark}>
            *
          </span>
        )}
      </div>
      {children({
        id,
        ...(name ? { name } : {}),
        'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-meta text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="animate-field-message mt-1.5 text-label font-medium text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function controlClasses(invalid?: boolean, className?: string) {
  return cx(
    'block w-full min-h-11 rounded-control border bg-surface px-3 py-2 text-control text-ink',
    'transition-[border-color,box-shadow] duration-[var(--motion-feedback)]',
    'placeholder:text-ink-subtle placeholder:font-normal',
    'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
    // Read-only (e.g. a closed period): still focusable and copyable, visibly not editable — no fill and a
    // dashed edge, so it is not confused with disabled (sunken fill, faded text: not available at all).
    '[&:is(input,textarea):read-only:not(:disabled)]:border-dashed [&:is(input,textarea):read-only:not(:disabled)]:border-rule-strong [&:is(input,textarea):read-only:not(:disabled)]:bg-transparent',
    invalid
      ? 'border-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-danger)_22%,transparent)]'
      : 'border-rule-strong hover:border-ink-subtle focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus)_24%,transparent)]',
    className,
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Content direction, e.g. "ltr" for email/phone/username. */
  dir?: 'ltr' | 'rtl';
  /** Element in the trailing slot (inline-end), e.g. a reveal button. */
  trailing?: ReactNode;
  /** Element in the leading slot (inline-start), e.g. a currency sign. */
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, dir, trailing, leading, className, ...rest },
  ref,
) {
  const invalidFromAria = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  return (
    <div className="relative" dir={dir}>
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex w-10 items-center justify-center text-ink-subtle">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        dir={dir}
        className={controlClasses(invalid ?? invalidFromAria, cx(leading ? 'ps-10' : null, trailing ? 'pe-12' : null, className))}
        {...rest}
      />
      {trailing && <span className="absolute inset-y-0 end-0 flex w-12 items-center justify-center">{trailing}</span>}
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 4, ...rest },
  ref,
) {
  const invalidFromAria = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={controlClasses(invalid ?? invalidFromAria, cx('resize-y leading-relaxed', className))}
      {...rest}
    />
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** Native select: keeps the platform picker on phones, which beats any custom listbox there. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  const invalidFromAria = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  return (
    <div className="relative">
      <select
        ref={ref}
        className={controlClasses(invalid ?? invalidFromAria, cx('appearance-none pe-10', className))}
        {...rest}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-ink-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
});
