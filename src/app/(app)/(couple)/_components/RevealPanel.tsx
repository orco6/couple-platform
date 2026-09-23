'use client';

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';

import type { CalendarDate } from '@/core/dates/calendar-date';
import { copy } from '@/domain/copy';
import type { DayEntryValues } from '@/domain/day-entries/day-entries';
import type { PartnerRef } from '@/domain/partners';

import { reducedFade, spring } from './motion';
import { ReviewForm } from './ReviewForm';
import type { RatingValue } from './Slider';

/**
 * THE REVEAL.
 *
 * The partner's answer existed before this screen was opened; it was withheld
 * until this partner committed their own (R-DAY-05, enforced server-side — by
 * the time this renders, the values are simply present).
 *
 * It is staged as a meeting, in the product's own shape: two circles, one per
 * person, travel toward each other and settle overlapping — the logo — and the
 * part they share fills with the shared ink as they meet. The two answers
 * appear under them, then the sentence comparing them. No confetti,
 * no score: this is a reflection, not a result. Under reduced motion it is a
 * short fade in the same order.
 */
function gapLine(mine: DayEntryValues, theirs: DayEntryValues): string {
  const gap = Math.abs(mine.respectRating - theirs.respectRating);
  if (gap === 0) return copy.day.gapExact;
  if (gap === 1) return copy.day.gapClose;
  return copy.day.gapFar;
}

const CIRCLE = 120;
const OVERLAP = 26;

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
  const word = (value: number) => copy.day.scale[value as RatingValue];

  return (
    <section>
      <Meeting me={me} partner={partner} />

      {/* The words, under the circles and in the same left-to-right order. */}
      <div dir="ltr" className="mt-3 flex justify-center gap-4">
        {[
          { person: me, caption: copy.common.me, value: mine.respectRating },
          { person: partner, caption: partner.name, value: theirs.respectRating },
        ].map(({ person, caption, value }) => (
          <motion.span
            key={person.id}
            dir="rtl"
            className="block text-center"
            style={{ width: CIRCLE }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: reduced ? 0.05 : 0.35 }}
          >
            <span className="block truncate text-meta text-ink-muted">{caption}</span>
            <span className="block text-section font-semibold text-ink">{word(value)}</span>
          </motion.span>
        ))}
      </div>

      <motion.p
        className="mt-7 text-center text-title leading-snug font-semibold text-balance text-ink"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0.1 : 0.55 }}
      >
        {gapLine(mine, theirs)}
      </motion.p>

      {(mine.note || theirs.note) && (
        <motion.div
          className="panel panel-rows mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: reduced ? 0.15 : 0.8 }}
        >
          {mine.note && <Note label={copy.day.myNote} text={mine.note} />}
          {theirs.note && <Note label={copy.day.noteFrom(partner.name)} text={theirs.note} />}
        </motion.div>
      )}
    </section>
  );
}

/**
 * Two circles that travel toward each other and overlap, drawn in one SVG so
 * the shared part — the second circle clipped to the first, filled with the
 * shared ink — grows continuously as they meet. (A CSS blend mode only applies
 * once the transforms have settled, which made the overlap pop in at the end.)
 */
function Meeting({ me, partner }: { me: PartnerRef; partner: PartnerRef }) {
  const reduced = useReducedMotion();
  const r = CIRCLE / 2;
  const width = CIRCLE * 2 + 16 - OVERLAP;
  const leftAt = r + 8;
  const rightAt = width - r - 8;
  const travel = reduced ? 0 : 34;
  const ax = useMotionValue(leftAt - travel);
  const bx = useMotionValue(rightAt + travel);
  const clipId = useId();
  const gradA = useId();
  const gradB = useId();

  useEffect(() => {
    const options = reduced ? { duration: 0 } : { ...spring.soft, delay: 0.08 };
    const a = animate(ax, leftAt, options);
    const b = animate(bx, rightAt, options);
    return () => {
      a.stop();
      b.stop();
    };
  }, [ax, bx, leftAt, rightAt, reduced]);

  const fill = (side: 'a' | 'b') => `url(#${side === 'a' ? gradA : gradB})`;
  const light = (id: string, token: string) => (
    <radialGradient id={id} cx="35%" cy="30%" r="75%">
      <stop offset="0%" style={{ stopColor: `color-mix(in oklab, var(${token}) 50%, white)` }} />
      <stop offset="70%" style={{ stopColor: `var(${token})` }} />
    </radialGradient>
  );

  return (
    <motion.svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${CIRCLE}`}
      width={width}
      height={CIRCLE}
      className="mx-auto block overflow-visible"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? reducedFade : { duration: 0.25 }}
    >
      <defs>
        {light(gradA, '--brand-partner-a')}
        {light(gradB, '--brand-partner-b')}
        <clipPath id={clipId}>
          <motion.circle cx={ax} cy={r} r={r} />
        </clipPath>
      </defs>
      <motion.circle cx={ax} cy={r} r={r} fill={fill(me.side)} />
      <motion.circle cx={bx} cy={r} r={r} fill={fill(partner.side)} />
      <motion.circle
        cx={bx}
        cy={r}
        r={r}
        clipPath={`url(#${clipId})`}
        style={{ fill: 'color-mix(in oklab, color-mix(in oklab, var(--brand-partner-a) 50%, var(--brand-partner-b)) 78%, black)' }}
      />
    </motion.svg>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <figure className="px-4 py-3.5">
      <figcaption className="text-meta font-medium text-ink-muted">{label}</figcaption>
      <blockquote className="mt-1 text-row whitespace-pre-line text-ink">{text}</blockquote>
    </figure>
  );
}

/**
 * WAITING — this person has closed the day and the other has not.
 *
 * Two circles again, this time apart: mine solid, theirs an outline. Nothing
 * about the other's answer exists on this page (R-DAY-05), and nothing here
 * pretends to know it. Changing my own answer stays possible until the other
 * closes (R-DAY-03), one tap away rather than a second form on the screen.
 */
export function WaitingPanel({
  partner,
  partnerName,
  date,
  mine,
  canAmend,
}: {
  partner: PartnerRef | null;
  partnerName: string;
  date: CalendarDate;
  mine: DayEntryValues;
  canAmend: boolean;
}) {
  const reduced = useReducedMotion();
  const [amending, setAmending] = useState(false);
  const size = 96;
  const mineColour = `var(--orb-day-${mine.respectRating})`;

  return (
    <section>
      {/* Mine: a light in the colour of my own answer. Theirs: not yet. */}
      <div className="flex items-center justify-center gap-5" dir="ltr" aria-hidden="true">
        <span
          className="rounded-full"
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${mineColour} 45%, white), ${mineColour} 70%)`,
            boxShadow: `0 0 0 8px color-mix(in oklab, ${mineColour} 16%, transparent), 0 18px 40px -10px ${mineColour}`,
          }}
        />
        <span className="rounded-full border-2 border-dashed border-rule-strong" style={{ width: size, height: size }} />
      </div>
      <p className="mt-3 text-center text-meta text-ink-muted" dir="ltr">
        <span className="inline-block w-24 text-center">{copy.day.scale[mine.respectRating as RatingValue]}</span>
        <span className="inline-block w-24" />
      </p>

      <div className="mt-6 text-center">
        <p className="text-section font-semibold text-balance text-ink">{partner ? copy.day.waitingTitle(partnerName.split(' ')[0] ?? partnerName) : copy.errors.noPartnerYet}</p>
        <p className="mx-auto mt-1 max-w-xs text-body text-balance text-ink-muted">{copy.day.waitingWhy}</p>
      </div>

      {canAmend && (
        <div className="mt-8">
          <AnimatePresence initial={false} mode="wait">
            {amending ? (
              <motion.div
                key="form"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? reducedFade : spring.settle}
              >
                <ReviewForm date={date} mode="amend" existing={mine} />
              </motion.div>
            ) : (
              <motion.div key="toggle" exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="text-center">
                <button
                  type="button"
                  onClick={() => setAmending(true)}
                  className="tap-quiet press inline-flex min-h-11 items-center rounded-chip px-4 text-body font-medium text-accent-text hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {copy.day.amendAction}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
