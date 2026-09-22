import { brand } from './brand';

/**
 * BRAND MARK — replace per project.
 *
 * The default mark for "יסוד" (foundation): three courses of a wall, the top
 * one offset. Drawn in currentColor-free accent so it survives on any surface.
 * Keep a real business's logo as an inline SVG here (or next/image with a file
 * in public/brand/) so it renders crisp and needs no extra request.
 */
export function Logo({ withName = true, className }: { withName?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true">
        <rect x="3" y="15" width="18" height="5" rx="1" fill="var(--color-accent)" />
        <rect x="3" y="9" width="11" height="5" rx="1" fill="var(--color-accent)" opacity="0.72" />
        <rect x="15" y="9" width="6" height="5" rx="1" fill="var(--color-accent)" opacity="0.72" />
        <rect x="7" y="3" width="10" height="5" rx="1" fill="var(--color-accent)" opacity="0.45" />
      </svg>
      {withName && <span className="text-row font-bold text-ink">{brand.appName}</span>}
    </span>
  );
}
