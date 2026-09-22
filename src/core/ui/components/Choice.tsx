'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/core/ui/cx';

/**
 * Checkbox, radio group and switch — native inputs, so keyboard behaviour,
 * form submission and screen-reader semantics are the platform's, not ours.
 * The whole row (label and description) is the touch target.
 */

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(
  { label, description, className, ...rest },
  ref,
) {
  const id = useId();
  return (
    <label htmlFor={rest.id ?? id} className={cx('flex min-h-11 cursor-pointer items-start gap-3 py-2', className)}>
      <input
        ref={ref}
        id={rest.id ?? id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-[4px] accent-[var(--color-accent)]"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-row text-ink">{label}</span>
        {description && <span className="block text-meta text-ink-subtle">{description}</span>}
      </span>
    </label>
  );
});

export interface RadioOption<V extends string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
}

export function RadioGroup<V extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  error,
  layout = 'stack',
}: {
  legend: string;
  name: string;
  value: V | null;
  onChange: (value: V) => void;
  options: readonly RadioOption<V>[];
  error?: string;
  /** 'segmented' renders equal-width tiles, for two or three short options. */
  layout?: 'stack' | 'segmented';
}) {
  const errorId = useId();
  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-label font-semibold text-ink-muted">{legend}</legend>
      <div className={layout === 'segmented' ? 'grid auto-cols-fr grid-flow-col gap-2' : 'space-y-0.5'}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cx(
                'flex min-h-11 cursor-pointer items-start gap-3 touch-manipulation',
                layout === 'segmented'
                  ? cx(
                      'items-center justify-center rounded-control border px-3 text-center transition-colors duration-[var(--motion-feedback)]',
                      'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-focus)]',
                      checked
                        ? 'border-accent bg-accent-tint font-semibold text-accent-text'
                        : 'border-rule-strong bg-surface text-ink-muted hover:bg-hover',
                    )
                  : 'py-2',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className={layout === 'segmented' ? 'sr-only' : 'mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]'}
              />
              <span className="min-w-0">
                <span className="block text-row">{option.label}</span>
                {option.description && layout === 'stack' && (
                  <span className="block text-meta text-ink-subtle">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="animate-field-message mt-1.5 text-label font-medium text-danger-text">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** An immediate on/off setting. For choices applied on "save", use Checkbox. */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const descriptionId = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-row text-ink">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-meta text-ink-subtle">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-[var(--motion-feedback)] disabled:opacity-50',
          checked ? 'border-accent bg-accent' : 'border-rule-strong bg-sunken',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-0.5 size-5.5 rounded-full bg-white shadow-[var(--shadow-raised)] transition-[inset-inline-start] duration-[var(--motion-feedback)]',
            checked ? 'start-[calc(100%-1.5rem)]' : 'start-0.5',
          )}
        />
      </button>
    </div>
  );
}
