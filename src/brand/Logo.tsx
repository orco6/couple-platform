import { brand } from './brand';

/**
 * BRAND MARK — שנינו.
 *
 * Two marks, just overlapping: the two people. The ember one sits in front,
 * separated by a hairline in the surrounding colour — the same treatment the
 * app uses wherever both partners appear together, so the logo is the product's
 * own vocabulary rather than an unrelated emblem.
 *
 * The colours are the two partner tokens, which is why the mark cannot be
 * recoloured independently of the people it stands for. In RTL the first mark
 * read is the one on the right, so the ember (partner A) leads.
 */
export function Logo({ withName = true, className }: { withName?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true">
        <circle cx="9.6" cy="12" r="5.8" fill="var(--brand-partner-b)" />
        <circle
          cx="14.6"
          cy="12"
          r="5.8"
          fill="var(--brand-partner-a)"
          stroke="var(--color-chrome)"
          strokeWidth="1.4"
        />
      </svg>
      {withName && <span className="text-row font-semibold text-ink">{brand.appName}</span>}
    </span>
  );
}
