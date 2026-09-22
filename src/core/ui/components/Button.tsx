'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '@/core/ui/cx';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

/**
 * Buttons.
 *
 *   primary    the one action a screen or dialog exists for. At most one per view.
 *   secondary  an alternative action with an edge.
 *   quiet      low-emphasis: cancel, secondary toolbar actions.
 *   danger     destructive, used only where the verb is destructive.
 *
 * A loading button keeps its exact width: the spinner is laid over the label,
 * which fades out but stays in place (and stays the accessible name). Adding a
 * spinner beside the label widened the button mid-click and shifted its
 * neighbours. It is aria-busy and ignores clicks — the first line of
 * duplicate-submit defence — but is not `disabled`, so keyboard focus stays on it.
 * The swap waits 150ms: a save that finishes faster never flashes a spinner.
 * Touch targets are at least 44px tall at size "md".
 */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className, children, type = 'button', onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {loading && <Spinner className="spinner-delayed absolute size-4.5" />}
      <span className={cx('inline-flex items-center gap-[inherit]', loading && 'button-loading-label')}>
        {children}
      </span>
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control needs an accessible name. */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted touch-manipulation',
        'transition-[background-color,color,transform] duration-200 ease-out hover:bg-hover hover:text-ink disabled:opacity-50',
        'active:scale-[0.94] active:duration-[40ms] motion-reduce:active:scale-100 disabled:active:scale-100',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
