'use client';

import { useId, useState, type ReactNode } from 'react';
import { copy } from '@/core/copy';
import { Button, IconButton } from './Button';
import { CloseIcon } from './Icons';
import { Overlay, type OverlayPresentation } from './Overlay';

/**
 * Dialog: a titled overlay with a body and an optional pinned footer.
 * On phones it is a bottom sheet (presentation "auto"); from 640px, a centred
 * dialog. The footer stays reachable above the keyboard without scrolling.
 */

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line of context under the title — not instructions. */
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  presentation?: OverlayPresentation;
  /** Set false while saving so the dialog cannot be dismissed mid-write. */
  dismissible?: boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** After the close transition has finished: open the next overlay here, not in onClose. */
  onExited?: () => void;
  testId?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  presentation = 'auto',
  dismissible = true,
  initialFocus,
  onExited,
  testId,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      presentation={presentation}
      size={size}
      dismissible={dismissible}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      initialFocus={initialFocus}
      onExited={onExited}
      testId={testId}
    >
      <header className="flex items-start gap-2 px-5 pb-3 pt-2 sm:px-6 sm:pt-5">
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 id={titleId} className="heading-section text-section text-balance text-ink">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-1 text-body text-ink-muted">
              {description}
            </p>
          )}
        </div>
        <IconButton label={copy.common.close} onClick={onClose} disabled={!dismissible} className="-me-2">
          <CloseIcon />
        </IconButton>
      </header>
      <div data-overlay-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">
        {children}
      </div>
      {footer && (
        <footer data-overlay-footer className="pb-safe border-t border-rule-faint bg-surface px-5 pt-3 sm:px-6 sm:pb-4">{footer}</footer>
      )}
    </Overlay>
  );
}

/** A bottom sheet at every width: action lists, pickers, the mobile "more" menu. */
export function BottomSheet(props: Omit<DialogProps, 'presentation'>) {
  return <Dialog {...props} presentation="sheet" />;
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, concretely. Never just "are you sure?". */
  body: ReactNode;
  /** The verb, matching the button that opened it: "העברה לארכיון", not "אישור". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => Promise<unknown> | unknown;
  onCancel: () => void;
  /** Extra content, e.g. a required reason field. */
  children?: ReactNode;
  confirmDisabled?: boolean;
}

/**
 * Confirmation. Cancel is first in the DOM and receives initial focus, so Enter
 * on a dialog nobody has read never performs the destructive action. The
 * dialog cannot be dismissed while the action is running.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = copy.common.cancel,
  tone = 'danger',
  onConfirm,
  onCancel,
  children,
  confirmDisabled,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={!working}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={working} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={confirm}
            loading={working}
            disabled={confirmDisabled}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-body leading-relaxed text-ink-muted">{body}</div>
        {children}
      </div>
    </Dialog>
  );
}
