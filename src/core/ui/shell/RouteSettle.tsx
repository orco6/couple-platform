'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * A short settle when the page changes: 160ms of opacity from 0.35, keyed
 * on the pathname. A hard DOM swap between sections feels abrupt next to the
 * overlays' motion; anything longer, or an exit animation, would make people
 * wait to see data that has already arrived (Koma's ViewTransition, measured).
 *
 * Keyed on the pathname only. Filters, sorting and pagination change search
 * params and must NOT replay it — and reading useSearchParams here would opt
 * the whole page into client rendering (Koma shipped doubled content that way).
 * Opacity only: no transform, so it never becomes the containing block of a
 * fixed descendant, even mid-animation (ADR 0014). Reduced motion: none.
 */
export function RouteSettle({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-route-settle">
      {children}
    </div>
  );
}
