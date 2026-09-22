'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * A short settle when the page changes: 180ms, opacity plus a 4px rise, keyed
 * on the pathname. A hard DOM swap between sections feels abrupt next to the
 * overlays' motion; anything longer, or an exit animation, would make people
 * wait to see data that has already arrived (Koma's ViewTransition, measured).
 *
 * Keyed on the pathname only. Filters, sorting and pagination change search
 * params and must NOT replay it — and reading useSearchParams here would opt
 * the whole page into client rendering (Koma shipped doubled content that way).
 * The animation ends at `transform: none`, so it never leaves a containing
 * block that would break sticky or fixed descendants. Reduced motion: none.
 */
export function RouteSettle({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-route-settle">
      {children}
    </div>
  );
}
