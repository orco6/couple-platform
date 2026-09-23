'use client';

import { motion, useTransform, type MotionValue } from 'motion/react';

import { cx } from '@/core/ui/cx';

/**
 * The light an answer throws: five fixed colour fields (dusk → morning), whose
 * weights follow a continuous 0..1 position. Dragging between 2 and 3 is a
 * blend of the two, so the room changes under the finger instead of snapping
 * from one picture to the next. Opacity only — the gradients never repaint.
 *
 * `contained` keeps it inside its parent (a sheet); otherwise it lights the
 * whole screen behind the content.
 */
export function Moods({ progress, on, contained = false }: { progress: MotionValue<number>; on: boolean; contained?: boolean }) {
  const weights = [useWeight(progress, 0), useWeight(progress, 1), useWeight(progress, 2), useWeight(progress, 3), useWeight(progress, 4)];
  return (
    <span aria-hidden="true" className={cx('moods', contained ? 'moods--contained' : 'moods--room')} data-on={on}>
      {weights.map((opacity, index) => (
        <motion.span key={index} className={`mood-layer mood-${index + 1}`} style={{ opacity }} />
      ))}
    </span>
  );
}

function useWeight(progress: MotionValue<number>, stop: number) {
  return useTransform(progress, (fraction) => Math.max(0, 1 - Math.abs(fraction * 4 - stop)));
}
