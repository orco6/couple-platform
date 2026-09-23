'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { cx } from '@/core/ui/cx';

/**
 * THE SHEET — for small moments over Today that need no keyboard (rating a
 * task). Anything with typing is a full-screen Composer instead: on a real
 * iPhone, a bottom sheet with a text field fights the keyboard however it is
 * built (Safari pans the whole viewport to reveal the field), and the fourth
 * edition stopped trying.
 *
 *   • A native <dialog> opened with showModal() — focus stays inside, Escape
 *     closes, the page behind is inert.
 *   • Enters on the drawer curve (cubic-bezier(.32,.72,0,1), 420ms), leaves
 *     faster (240ms) — transform and opacity only.
 *   • Follows the finger: the grip (a full-width strip at the top) drags the
 *     sheet down 1:1, the scrim fading with it; let go past a third of its
 *     height or with a flick and it leaves, otherwise it springs back.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  dismissible = true,
  initialFocus,
  className,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name. The visible sheet usually has no title. */
  label: string;
  children: ReactNode;
  dismissible?: boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
  className?: string;
  testId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const restore = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Mount on open (render-phase); leave with the exit transition, then unmount.
  if (open && !mounted) setMounted(true);
  if (!mounted && shown) setShown(false);
  const visible = open && shown;

  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  // Closing: the exit fade still plays, but not as a MODAL — a modal dialog
  // makes the page behind inert, and a tap in those ~200ms (the next task's
  // circle, a swipe) would be swallowed. Re-shown non-modally, it is only a
  // picture fading out, and it lets the finger through (pointer-events: none).
  useEffect(() => {
    if (open) return;
    const node = dialog.current;
    if (node?.open && node.matches(':modal')) {
      node.close();
      node.show();
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const node = dialog.current;
    if (!node) return;
    restore.current = document.activeElement as HTMLElement | null;
    if (!node.open) node.showModal();
    // showModal() focuses the first control without preventScroll while the
    // panel is still below the screen, scrolling the dialog; undo it before paint.
    node.scrollTop = 0;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      setShown(true);
      const target = initialFocus?.current ?? node.querySelector<HTMLElement>('input, textarea, button, [tabindex]');
      target?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      root.style.overflow = previous;
      if (node.open) node.close();
      const back = restore.current;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
    // initialFocus is read once, at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Drag to dismiss, from the grip.
  const panel = useRef<HTMLDivElement>(null);
  const pull = useRef<{ id: number; y: number; t: number; dy: number; v: number } | null>(null);
  function setPull(dy: number | null) {
    const node = dialog.current;
    if (!node) return;
    if (dy === null) {
      node.removeAttribute('data-pulling');
      node.style.removeProperty('--sheet-pull');
      node.style.removeProperty('--sheet-pull-ratio');
      return;
    }
    const height = panel.current?.offsetHeight ?? 400;
    node.setAttribute('data-pulling', '');
    node.style.setProperty('--sheet-pull', `${dy}px`);
    node.style.setProperty('--sheet-pull-ratio', String(Math.min(1, dy / height)));
  }

  if (!mounted) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-testid={testId}
      data-shown={visible}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onScroll={(event) => {
        event.currentTarget.scrollTop = 0;
      }}
      className="sheet-dialog"
    >
      <div aria-hidden="true" className="sheet-scrim" onClick={() => dismissible && onClose()} />
      <h2 id={titleId} className="sr-only">
        {label}
      </h2>
      <div ref={panel} className={cx('sheet-panel', className)}>
        <div
          aria-hidden="true"
          className="sheet-grip-zone"
          onPointerDown={(event) => {
            if (!dismissible) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pull.current = { id: event.pointerId, y: event.clientY, t: event.timeStamp, dy: 0, v: 0 };
          }}
          onPointerMove={(event) => {
            const current = pull.current;
            if (current?.id !== event.pointerId) return;
            const raw = event.clientY - current.y;
            // Down follows the finger; up resists (a sheet has nowhere to go).
            const dy = raw > 0 ? raw : raw / 6;
            const dt = Math.max(1, event.timeStamp - current.t);
            current.v = (dy - current.dy) / dt;
            current.dy = dy;
            current.t = event.timeStamp;
            setPull(dy);
          }}
          onPointerUp={(event) => {
            const current = pull.current;
            if (current?.id !== event.pointerId) return;
            pull.current = null;
            const height = panel.current?.offsetHeight ?? 400;
            const leave = current.dy > height / 3 || (current.dy > 24 && current.v > 0.5);
            if (leave) {
              // Leave from where the finger let go: the exit transition starts at the
              // pulled position, so nothing snaps back first.
              dialog.current?.removeAttribute('data-pulling');
              onClose();
            } else {
              setPull(null);
            }
          }}
          onPointerCancel={() => {
            pull.current = null;
            setPull(null);
          }}
        >
          <span className="sheet-grip" />
        </div>
        {children}
      </div>
    </dialog>
  );
}
