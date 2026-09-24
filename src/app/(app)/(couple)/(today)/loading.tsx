import { Skeleton } from '@/core/ui/components/States';
import { copy } from '@/domain/copy';

import { CoupleLoader } from '../_components/CoupleLoader';
import { Screen } from '../_components/Screen';

/**
 * Today, arriving: the tab tap is answered at once with the page's own shape
 * (the two lights, the title's place, the list's card) while the data makes
 * its round trip. Today lives in its own route group so this boundary covers
 * it alone (ADR 0014: a loading state only where it matches its screen).
 */
export default function TodayLoading() {
  return (
    <Screen className="pb-24">
      <header className="mb-7 px-2 pt-8">
        <div aria-hidden="true" className="mb-5 flex justify-start text-[2.25rem]">
          <CoupleLoader />
        </div>
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-4 h-14 w-full rounded-[1.25rem]" />
      </header>
      <div role="status" aria-label={copy.today.loading}>
        <div className="flex items-baseline justify-between px-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="mx-1 mt-3 h-2.5" />
        <div className="glass mt-5 space-y-5 px-4 py-5">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="size-7 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
