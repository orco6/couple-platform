'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, prefersReducedMotion } from '@/core/ui/motion';

/**
 * The overlay primitive behind Dialog, BottomSheet and ConfirmDialog.
 *
 * Built on the native <dialog> element opened with showModal(), which gives the
 * top layer, an inert page behind it, and Escape handling for free. On top of
 * that it adds what the platform does not:
 *
 *   • enter/exit transitions (CSS in foundation.css, driven by data-state)
 *   • a Tab focus trap that wraps inside the panel
 *   • focus restoration to the element that opened it
 *   • page scroll lock
 *   • drag-to-dismiss on the sheet handle (touch and mouse)
 *   • a `dismissible` switch, so a dialog busy saving cannot be closed mid-write
 *   • `onExited`, called once the exit transition has finished and the overlay
 *     is gone — the place to open the NEXT overlay (a menu item that opens a
 *     dialog, a success sheet after a form). Two overlays animating at once read
 *     as a glitch; Tovli's sheets run follow-up actions only after closing.
 *
 * Presentations: "auto" (sheet on phones, dialog from 640px), "sheet", "dialog".
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export type OverlayPresentation = 'auto' | 'sheet' | 'dialog';

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  presentation?: OverlayPresentation;
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
  labelledBy: string;
  describedBy?: string;
  /** Element to focus on open. Defaults to the first focusable in the body, then the panel. */
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** Called after the exit transition, when the overlay has unmounted. */
  onExited?: () => void;
  children: ReactNode;
  testId?: string;
}

function isSheetOnScreen(presentation: OverlayPresentation): boolean {
  if (presentation === 'sheet') return true;
  if (presentation === 'dialog') return false;
  return !window.matchMedia('(min-width: 640px)').matches;
}

export function Overlay({
  open,
  onClose,
  presentation = 'auto',
  size = 'md',
  dismissible = true,
  labelledBy,
  describedBy,
  initialFocus,
  onExited,
  children,
  testId,
}: OverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'open' | 'closed'>('closed');

  const dismissibleRef = useRef(dismissible);
  const onCloseRef = useRef(onClose);
  const onExitedRef = useRef(onExited);
  useEffect(() => {
    dismissibleRef.current = dismissible;
    onCloseRef.current = onClose;
    onExitedRef.current = onExited;
  });

  const requestClose = useCallback(() => {
    if (dismissibleRef.current) onCloseRef.current();
  }, []);

  // Mount on open and start the exit on close, adjusted during render (not in an
  // effect) so there is no extra commit with stale state.
  const [exiting, setExiting] = useState(false);
  if (open && !mounted) setMounted(true);
  if (!open && state === 'open') {
    setState('closed');
    setExiting(true);
  }
  // Reopened while the exit was still playing: go straight back to open.
  if (open && exiting) {
    setExiting(false);
    setState('open');
  }

  // After the exit transition has played, unmount.
  useEffect(() => {
    if (open || !mounted) return;
    const exitMs = prefersReducedMotion()
      ? motion.reducedMs
      : isSheetOnScreen(presentation)
        ? motion.sheetExitMs
        : motion.dialogExitMs;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
      onExitedRef.current?.();
    }, exitMs + 40);
    return () => window.clearTimeout(timer);
  }, [open, mounted, presentation]);

  // Show the native dialog, lock scroll, move focus in; undo all of it on unmount.
  useLayoutEffect(() => {
    if (!mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    // showModal() focuses the first control inside, WITHOUT preventScroll —
    // and at that moment the panel is still off-screen (the enter transition
    // starts at translateY(100%)), so the browser scrolls the overflow:hidden
    // dialog to reveal it. The panel then flashes in un-animated, jumps up as
    // the transition runs on top of that scroll, and snaps back. The dialog
    // never scrolls on purpose: undo it before the first paint.
    dialog.scrollTop = 0;
    dialog.scrollLeft = 0;

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setState('open'));
      const panel = panelRef.current;
      const firstIn = (selector: string) =>
        panel?.querySelector(selector)?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
      // Body first (the form), then footer (for a confirmation, that is Cancel),
      // never the close button in the header.
      const target = initialFocus?.current ?? firstIn('[data-overlay-body]') ?? firstIn('[data-overlay-footer]') ?? panel;
      target?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      root.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      const restore = restoreFocusRef.current;
      if (restore && document.contains(restore)) restore.focus({ preventScroll: true });
    };
    // initialFocus is read once at open time on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // ── Drag to dismiss (sheet presentation only) ─────────────────────────────
  const drag = useRef<{ startY: number; startTime: number; offset: number; pointerId: number } | null>(null);

  const onHandlePointerDown = (event: React.PointerEvent) => {
    if (!isSheetOnScreen(presentation) || !dismissibleRef.current) return;
    drag.current = { startY: event.clientY, startTime: performance.now(), offset: 0, pointerId: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    panelRef.current?.setAttribute('data-dragging', '');
  };

  const onHandlePointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    const panel = panelRef.current;
    if (!current || !panel || event.pointerId !== current.pointerId) return;
    const delta = event.clientY - current.startY;
    // Downward follows the finger; upward resists (a sheet has nowhere to go).
    current.offset = delta > 0 ? delta : delta / 6;
    panel.style.setProperty('--sheet-drag', `${current.offset}px`);
  };

  const onHandlePointerUp = (event: React.PointerEvent) => {
    const current = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!current || !panel) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(current.pointerId);
    panel.removeAttribute('data-dragging');
    const elapsed = Math.max(1, performance.now() - current.startTime);
    const velocity = current.offset / elapsed;
    const threshold = Math.min(140, panel.offsetHeight * 0.3);
    panel.style.setProperty('--sheet-drag', '0px');
    if (current.offset > threshold || (current.offset > 24 && velocity > 0.6)) requestClose();
  };

  if (!mounted) return null;

  return (
    <dialog
      ref={dialogRef}
      className="overlay"
      data-state={state}
      data-presentation={presentation}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={onKeyDown}
      onScroll={(event) => {
        // See above: nothing inside should ever scroll the dialog itself.
        event.currentTarget.scrollTop = 0;
        event.currentTarget.scrollLeft = 0;
      }}
    >
      <div className="overlay-scrim" aria-hidden="true" onClick={requestClose} />
      <div ref={panelRef} className="overlay-panel" data-size={size} tabIndex={-1}>
        <div
          className="overlay-handle"
          aria-hidden="true"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span />
        </div>
        {children}
      </div>
    </dialog>
  );
}
