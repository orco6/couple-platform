import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

/** A navigation that looks like a button. Server-safe. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />;
}

