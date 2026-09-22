import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { copy } from '@/domain/copy';
import type { TrendDirection } from '@/domain/summaries/calculations';

/**
 * A month's shape, as one line.
 *
 * Deliberately small and unlabelled: no axis, no gridlines, no tooltip. It
 * answers "is this going up or down" at a glance, and the word beside it says
 * which — so the line is never the only signal, and nobody has to read a chart
 * to get the point.
 *
 * Missing weeks break the line rather than dropping it to zero: a week nobody
 * closed is not a bad week.
 */
const W = 220;
const H = 44;

export function TrendLine({
  title,
  values,
  direction,
  min,
  max,
  tone,
  caption,
}: {
  title: string;
  values: readonly (number | null)[];
  direction: TrendDirection;
  min: number;
  max: number;
  tone: 'warm' | 'cool' | 'accent';
  caption: string;
}) {
  const colour =
    tone === 'warm' ? 'var(--brand-partner-a)' : tone === 'cool' ? 'var(--brand-partner-b)' : 'var(--color-accent)';

  const points = values.flatMap((value, index) => {
    if (value === null) return [];
    const x = values.length <= 1 ? W / 2 : (index / (values.length - 1)) * (W - 8) + 4;
    const span = Math.max(1, max - min);
    const y = H - 6 - ((value - min) / span) * (H - 12);
    return [{ x, y }];
  });

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');

  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const word = direction === 'up' ? copy.month.trendUp : direction === 'down' ? copy.month.trendDown : copy.month.trendFlat;

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-label font-semibold text-ink-muted">{title}</p>
        <span className="flex items-center gap-1.5 text-meta text-ink-subtle">
          <Icon aria-hidden="true" size={14} />
          {word}
        </span>
      </div>

      {points.length < 2 ? (
        <p className="mt-3 text-body text-ink-subtle">{copy.month.noData}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`${title}: ${word}`}>
          <path d={path} fill="none" stroke={colour} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="var(--color-surface)"
              stroke={colour}
              strokeWidth="2"
            />
          ))}
        </svg>
      )}

      <p className="mt-2 text-meta text-ink-subtle">{caption}</p>
    </section>
  );
}
