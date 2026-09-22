'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Star } from 'lucide-react';

import { copy } from '@/domain/copy';
import type { DayEntryValues } from '@/domain/day-entries/day-entries';
import type { PartnerRef } from '@/domain/partners';

import { PartnerMark } from './PartnerMark';

/**
 * THE REVEAL.
 *
 * The partner's answer existed before this screen was opened; it was withheld
 * until this partner committed their own (R-DAY-05, enforced server-side — by
 * the time this component renders the values are simply present or absent).
 *
 * So it is staged as an arrival rather than a render: the two sides come in
 * from opposite edges and settle, then the line comparing them lands. Under
 * reduced motion it is a short fade in the same order — the sequence still
 * reads, nothing travels.
 */
function gapLine(mine: DayEntryValues, theirs: DayEntryValues): string {
  const gap = Math.abs(mine.respectRating - theirs.respectRating);
  if (gap === 0) return copy.day.gapExact;
  if (gap === 1) return copy.day.gapClose;
  return copy.day.gapFar;
}

export function RevealPanel({
  me,
  partner,
  mine,
  theirs,
}: {
  me: PartnerRef;
  partner: PartnerRef;
  mine: DayEntryValues;
  theirs: DayEntryValues;
}) {
  const reduced = useReducedMotion();

  const enter = (from: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.12 } }
      : {
          initial: { opacity: 0, x: from, scale: 0.97 },
          animate: { opacity: 1, x: 0, scale: 1 },
          transition: { type: 'spring' as const, stiffness: 160, damping: 22, mass: 1 },
        };

  return (
    <section>
      <p className="mb-4 text-label font-semibold text-ink-subtle">{copy.day.revealedTitle}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <motion.div {...enter(18)}>
          <Side partner={me} caption={copy.common.me} values={mine} />
        </motion.div>
        <motion.div {...enter(-18)}>
          <Side partner={partner} caption={partner.name} values={theirs} />
        </motion.div>
      </div>

      <motion.p
        className="mt-6 text-section leading-snug font-semibold text-balance text-ink"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0.1 : 0.45 }}
      >
        {gapLine(mine, theirs)}
      </motion.p>
    </section>
  );
}

function Side({ partner, caption, values }: { partner: PartnerRef; caption: string; values: DayEntryValues }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <PartnerMark partner={partner} size={28} />
        <span className="text-body font-semibold text-ink">{caption}</span>
      </div>

      <div
        className="flex w-fit items-center gap-1.5"
        dir="ltr"
        aria-label={`${values.respectRating} ${copy.common.outOfFive}`}
      >
        {[1, 2, 3, 4, 5].map((step) => (
          <Star
            key={step}
            aria-hidden="true"
            size={18}
            strokeWidth={step <= values.respectRating ? 0 : 1.75}
            className={step <= values.respectRating ? 'fill-current text-accent' : 'text-rule-strong'}
          />
        ))}
      </div>
      <p className="mt-2 text-body text-ink-muted">{copy.day.scale[values.respectRating as 1 | 2 | 3 | 4 | 5]}</p>

      {values.note && (
        <p className="mt-3 border-t border-rule-faint pt-3 text-body whitespace-pre-line text-ink-muted">{values.note}</p>
      )}
    </div>
  );
}
