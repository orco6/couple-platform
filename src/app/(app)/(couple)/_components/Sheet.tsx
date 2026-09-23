'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { cx } from '@/core/ui/cx';

/**
 * THE SHEET — for the two small moments that happen over Today: adding a task
 * and rating one.
 *
 * Why not the foundation's BottomSheet: on a real iPhone it opened, then
 * shifted by ~10px as focus landed, and its footer sat under the keyboard
 * (iOS does not move position:fixed content above the keyboard). This one:
 *
 *   • is a native <dialog> opened with showModal() — focus stays inside,
 *     Escape closes, the page behind is inert — so none of that is re-built;
 *   • rides the keyboard: it reads visualViewport and lifts itself by exactly
 *     the keyboard's height, with a transition matching the keyboard's own
 *     (~250ms), so the input and its send button stay above it and nothing
 *     jumps;
 *   • enters on the drawer curve (cubic-bezier(.32,.72,0,1), 420ms) and
 *     leaves faster (240ms) — transform and opacity only;
 *   • has a natural height: content decides, and it never re-measures while
 *     typing (nothing inside changes size unless the person asks for more).
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

  useLayoutEffect(() => {
    if (!mounted) return;
    const node = dialog.current;
    if (!node) return;
    restore.current = document.activeElement as HTMLElement | null;
    if (!node.open) node.showModal();
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

  // Ride the keyboard.
  useEffect(() => {
    if (!mounted) return;
    const viewport = window.visualViewport;
    const node = dialog.current;
    if (!viewport || !node) return;
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      node.style.setProperty('--sheet-keyboard', `${Math.round(keyboard)}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [mounted]);

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
      className="sheet-dialog"
    >
      <div aria-hidden="true" className="sheet-scrim" onClick={() => dismissible && onClose()} />
      <h2 id={titleId} className="sr-only">
        {label}
      </h2>
      <div className={cx('sheet-panel', className)}>
        <span aria-hidden="true" className="sheet-grip" />
        {children}
      </div>
    </dialog>
  );
}
