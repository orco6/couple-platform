import type { ReactNode } from 'react';
import { formatCalendarDate, type CalendarDate } from '@/core/dates/calendar-date';
import { formatDateTime } from '@/core/dates/instant';
import { formatMoney, type FormatMoneyOptions } from '@/core/money/format';
import type { Minor } from '@/core/money/money';
import { cx } from '@/core/ui/cx';

/**
 * Mixed-direction text.
 *
 * Inside Hebrew, a phone number, email, URL, username, invoice number or amount
 * is an LTR run. Wrapping it in <bdi dir="ltr"> isolates it: its punctuation
 * cannot reorder against the surrounding Hebrew ("050-1234567" never becomes
 * "1234567-050"), and the enclosing block keeps its own alignment.
 */
export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}

export function MoneyText({ value, className, ...options }: { value: Minor | null; className?: string } & FormatMoneyOptions) {
  if (value === null) return <span className="text-ink-subtle">—</span>;
  return (
    <bdi dir="ltr" className={cx('tnum', className)}>
      {formatMoney(value, options)}
    </bdi>
  );
}

export function DateText({ value, className }: { value: CalendarDate | null; className?: string }) {
  if (!value) return <span className="text-ink-subtle">—</span>;
  return (
    <time dateTime={value} className={cx('tnum', className)}>
      <bdi dir="ltr">{formatCalendarDate(value)}</bdi>
    </time>
  );
}

export function DateTimeText({ value, className }: { value: string | Date | null; className?: string }) {
  if (!value) return <span className="text-ink-subtle">—</span>;
  const iso = typeof value === 'string' ? value : value.toISOString();
  return (
    <time dateTime={iso} className={cx('tnum', className)}>
      <bdi dir="ltr">{formatDateTime(iso)}</bdi>
    </time>
  );
}

export function PhoneLink({ value }: { value: string | null }) {
  if (!value) return <span className="text-ink-subtle">—</span>;
  return (
    <a href={`tel:${value.replace(/[^\d+]/g, '')}`} className="text-accent-text underline-offset-2 hover:underline">
      <bdi dir="ltr" className="tnum">{value}</bdi>
    </a>
  );
}

/**
 * A long address wraps where a person would break it — after "@" and dots — not between any two letters
 * (`break-all` turned "…org.il" into "…org.i" / "l" on a phone). `<wbr>` changes neither the link target
 * nor the accessible name; `overflow-wrap: anywhere` remains the last resort for one very long part.
 */
export function EmailLink({ value }: { value: string | null }) {
  if (!value) return <span className="text-ink-subtle">—</span>;
  const parts = value.split(/(?<=[@.])/);
  return (
    <a href={`mailto:${value}`} className="text-accent-text underline-offset-2 [overflow-wrap:anywhere] hover:underline">
      <bdi dir="ltr">
        {parts.map((part, index) => (
          <span key={index}>
            {index > 0 && <wbr />}
            {part}
          </span>
        ))}
      </bdi>
    </a>
  );
}
