import Link from 'next/link';
import { ArrowLeft, Moon, Sparkles } from 'lucide-react';

import { copy } from '@/domain/copy';
import type { DayView } from '@/domain/day-entries/day-entries';

import { PartnerPair } from './PartnerMark';

/**
 * THE DAY, AS ONE OBJECT.
 *
 * The product's recurring object gets one consistent treatment, and this is it:
 * the single gradient surface on the screen, carrying both marks and the one
 * sentence about where the day stands. Everything else on Today is a white
 * card, so this reads as the subject rather than as decoration.
 *
 * It states one thing and offers one action. What it never does is show a
 * figure — the day's rating lives on the review screen, behind the reveal.
 */
export function DayHeroCard({ day, dateLabel }: { day: DayView; dateLabel: string }) {
  const partnerName = day.partner?.name ?? copy.common.partnerFallback;

  const { line, cta } = describe(day, partnerName);

  return (
    <section className="surface-aurora relative overflow-hidden p-5">
      {/* A soft highlight in the corner, so the gradient has a light source
          rather than being a flat ramp. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -end-10 -top-16 size-44 rounded-full bg-white/20 blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-meta text-on-accent/80">{dateLabel}</p>
          <p className="mt-1 text-section leading-snug font-semibold text-balance text-on-accent">{line}</p>
        </div>

        {day.partner && (
          <PartnerPair
            a={day.me.side === 'a' ? day.me : day.partner}
            b={day.me.side === 'a' ? day.partner : day.me}
            size={34}
            ring="transparent"
          />
        )}
      </div>

      {cta && (
        <Link
          href="/review"
          className="relative mt-4 inline-flex min-h-11 items-center gap-2 rounded-chip bg-white/18 px-4 text-row font-semibold text-on-accent backdrop-blur-sm transition-colors duration-200 hover:bg-white/26 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {day.revealed ? <Sparkles aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
          {cta}
          <ArrowLeft aria-hidden="true" size={16} />
        </Link>
      )}
    </section>
  );
}

/** One sentence about where the day stands, and the action if there is one. */
function describe(day: DayView, partnerName: string): { line: string; cta: string | null } {
  if (day.revealed) {
    return { line: copy.day.revealedTitle, cta: copy.day.pageTitle };
  }
  if (day.mine) {
    return { line: copy.day.waitingTitle(partnerName), cta: copy.day.alreadyClosed };
  }
  if (!day.canClose) {
    return { line: copy.day.notOpenYetWhy(day.reviewTime), cta: null };
  }
  if (day.partnerSubmitted) {
    return { line: copy.day.partnerClosedAlready(partnerName), cta: copy.day.submitAction };
  }
  return { line: copy.day.question, cta: copy.day.submitAction };
}
