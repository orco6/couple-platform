import { Skeleton } from '@/core/ui/components/States';
import { copy } from '@/domain/copy';

import { CoupleLoader } from '../_components/CoupleLoader';
import { Screen } from '../_components/Screen';

/**
 * The summary, arriving. A tab tap is answered at once with the page's own
 * shape — its real title, and one week card drawn in outline — while the data
 * makes its round trip (ADR 0014 allows a loading state only when it matches
 * the screen it stands in for). The two lights say it is on its way.
 */
export default function WeekLoading() {
  return (
    <Screen className="pb-24">
      <h1 className="large-title mt-2 px-1">{copy.week.overviewTitle}</h1>
      <p className="mt-1 px-1 text-body text-ink-muted">{copy.week.pageIntro}</p>
      <div className="figure-card mt-5 px-5 pt-4 pb-5" role="status" aria-label={copy.week.loading}>
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="mt-4 h-8 w-40" />
        <Skeleton className="mt-3 h-2.5 w-full" />
        <Skeleton className="mt-3 h-4 w-48" />
        <div className="mt-6 flex justify-center text-[1.25rem]">
          <CoupleLoader />
        </div>
      </div>
    </Screen>
  );
}
