import { cx } from '@/core/ui/cx';
import type { PartnerRef } from '@/domain/partners';

/**
 * A round mark carrying a partner's initial.
 *
 * Colour identifies who, and it is never the only signal: either an adjacent
 * name says it too, or the mark carries its own accessible name. The side comes
 * from the `Partnership` row, so the same person is the same colour on both
 * phones (src/domain/partners.ts).
 */
export function PartnerMark({
  partner,
  size = 32,
  label,
  className,
}: {
  partner: Pick<PartnerRef, 'initial' | 'side'>;
  size?: number;
  /** Accessible name. Omit when an adjacent label already names them. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('partner-mark', partner.side === 'a' ? 'partner-mark--a' : 'partner-mark--b', className)}
      style={{ '--mark-size': `${size}px` } as React.CSSProperties}
    >
      {partner.initial}
    </span>
  );
}

/**
 * Both marks, slightly overlapping — "us" rather than two users.
 *
 * `ring` must match what is actually behind the pair: a hardcoded colour shows
 * up as a halo on a card and as a notch in the dark scheme.
 */
export function PartnerPair({
  a,
  b,
  size = 24,
  ring = 'var(--color-surface)',
}: {
  a: Pick<PartnerRef, 'initial' | 'side'>;
  b: Pick<PartnerRef, 'initial' | 'side'>;
  size?: number;
  ring?: string;
}) {
  return (
    <span className="partner-pair" style={{ '--pair-ring': ring } as React.CSSProperties} aria-hidden="true">
      <PartnerMark partner={a} size={size} />
      <PartnerMark partner={b} size={size} />
    </span>
  );
}
