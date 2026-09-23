'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { cx } from '@/core/ui/cx';

import { spring } from './motion';

const ACTION = 88;

/**
 * A LIST ROW THAT SWIPES TO DELETE — the iOS gesture, for Hebrew.
 *
 * Drag the row toward the right and it follows the finger, uncovering a red
 * "מחיקה" at the left edge (the trailing edge in a right-to-left list, where
 * iOS puts it). Let go past halfway and it stays open; otherwise it springs
 * shut. Tapping "מחיקה" deletes: the row folds away (height and opacity), and
 * the rows below close the gap smoothly — the only movement in the list, and
 * the person asked for it.
 *
 *   • Vertical drags are left to the page (touch-action: pan-y); a drag only
 *     becomes a swipe once it is clearly sideways, and then it owns the
 *     pointer (capture), so a slightly diagonal swipe does not scroll.
 *   • A swipe never also taps: the click that ends it is swallowed.
 *   • Only one row is open at a time (the list owns `open`).
 *   • Not the only way: the edit screen has a visible delete, with a
 *     confirmation, for anyone who never swipes (and for keyboards and screen
 *     readers — the revealed button is hidden from them while closed).
 */
export function SwipeRow({
  open,
  onOpenChange,
  onDelete,
  removing,
  deleteLabel,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  removing: boolean;
  deleteLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const width = useTransform(x, (value) => Math.max(0, value));
  const drag = useRef<{ id: number; x0: number; y0: number; from: number; swiping: boolean } | null>(null);
  const swallowClick = useRef(false);
  const row = useRef<HTMLLIElement>(null);

  // The list closed this row (another one opened, or the task changed).
  useEffect(() => {
    if (drag.current) return;
    const controls = animate(x, open ? ACTION : 0, reduced ? { duration: 0 } : spring.snappy);
    return () => controls.stop();
  }, [open, reduced, x]);

  // Folding away: from the measured height to nothing.
  useEffect(() => {
    const node = row.current;
    if (!removing || !node) return;
    const height = node.offsetHeight;
    node.style.height = `${height}px`;
    node.style.minHeight = '0px';
    void node.offsetHeight;
    node.classList.add('row-removing');
    node.style.height = '0px';
  }, [removing]);

  return (
    <li
      ref={row}
      className={cx('swipe-row relative overflow-hidden', className)}
      onPointerDown={(event) => {
        if (event.button !== 0 || removing) return;
        drag.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, from: x.get(), swiping: false };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x0;
        const dy = event.clientY - current.y0;
        if (!current.swiping) {
          if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          current.swiping = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        // Follows the finger; past the action it resists, and it never goes left of shut.
        const raw = current.from + dx;
        const next = raw < 0 ? raw / 8 : raw > ACTION ? ACTION + (raw - ACTION) / 4 : raw;
        x.set(next);
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        if (!current || current.id !== event.pointerId || !current.swiping) return;
        swallowClick.current = true;
        const stayOpen = x.get() > ACTION / 2;
        animate(x, stayOpen ? ACTION : 0, reduced ? { duration: 0 } : spring.snappy);
        onOpenChange(stayOpen);
      }}
      onPointerCancel={() => {
        const current = drag.current;
        drag.current = null;
        if (current?.swiping) animate(x, open ? ACTION : 0, reduced ? { duration: 0 } : spring.snappy);
      }}
      onClickCapture={(event) => {
        if (swallowClick.current) {
          swallowClick.current = false;
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        // A tap on an open row closes it instead of acting on it.
        if (open && !(event.target as HTMLElement).closest('[data-swipe-action]')) {
          event.stopPropagation();
          event.preventDefault();
          onOpenChange(false);
        }
      }}
    >
      {/* The action, filling exactly the gap the row uncovers. */}
      <motion.span className="absolute inset-y-0 left-0 flex overflow-hidden" style={{ width }}>
        <button
          type="button"
          data-swipe-action
          tabIndex={open ? 0 : -1}
          aria-hidden={open ? undefined : true}
          onClick={onDelete}
          className="swipe-delete tap-quiet flex h-full min-w-[5.5rem] flex-col items-center justify-center gap-1 text-meta font-semibold focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus"
        >
          <Trash2 aria-hidden="true" size={20} />
          {deleteLabel}
        </button>
      </motion.span>

      <motion.div className="swipe-face relative" style={{ x }}>
        {children}
      </motion.div>
    </li>
  );
}
