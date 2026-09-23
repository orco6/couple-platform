'use client';

import { useMotionValue } from 'motion/react';

import { Moods } from './Moods';

/**
 * A period's tone, thrown on the room: the same five colour fields the daily
 * question uses, set to the period's average answer and softened. A good week
 * is read as warm light before a word of it is read; a hard one is a quiet
 * blue. Nothing when there is no answer to average.
 */
export function RoomTone({ average, strength = 0.7 }: { average: number | null; strength?: number }) {
  const progress = useMotionValue(average === null ? 0.5 : Math.min(1, Math.max(0, (average - 1) / 4)));
  return (
    <span style={{ '--moods-strength': strength } as React.CSSProperties} className="contents">
      <Moods progress={progress} on={average !== null} />
    </span>
  );
}
