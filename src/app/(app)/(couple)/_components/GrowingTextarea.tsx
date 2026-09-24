'use client';

import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react';

import { cx } from '@/core/ui/cx';

/**
 * A text field that grows with what is written, line by line, without a jump.
 *
 * A hidden mirror holds the same text with the same metrics; its height is the
 * field's height (a ResizeObserver hears typing and width changes alike), and
 * the field eases to it. It never collapses to measure, which is what makes
 * the usual "height: auto, then scrollHeight" trick flicker. Past `maxHeight`
 * the field stops growing and scrolls.
 */
export function GrowingTextarea({
  value,
  className,
  maxHeight = 0.4,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'style'> & {
  value: string;
  /** The tallest it grows, as a share of the screen's height. */
  maxHeight?: number;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const node = mirror.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(Math.min(node.offsetHeight, Math.round(window.innerHeight * maxHeight))));
    observer.observe(node);
    return () => observer.disconnect();
  }, [maxHeight]);

  return (
    <div className="relative w-full">
      <div ref={mirror} aria-hidden="true" className={cx(className, 'grow-mirror')}>
        {(value || rest.placeholder || '') + '\u200b'}
      </div>
      <textarea {...rest} value={value} className={cx(className, 'grow-field')} style={height ? { height } : undefined} />
    </div>
  );
}
