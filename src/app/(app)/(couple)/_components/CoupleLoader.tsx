import type { ReactNode } from 'react';

import { cx } from '@/core/ui/cx';

/**
 * WAITING, TOGETHER — the app's loader.
 *
 * The two lights (blue for partner A, pink for partner B) circle each other:
 * one passes in front while the other passes behind, so the pair reads as a
 * slow dance rather than a spinner. It is sized in `em`, so it takes the size
 * of the text it replaces. On a filled button (`onFill`) each light gets a thin
 * white edge so it never sinks into the button. With reduced motion the two
 * lights only breathe.
 */
export function CoupleLoader({ onFill = false, className }: { onFill?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('couple-loader', onFill && 'couple-loader--on-fill', className)}>
      <i />
      <i />
    </span>
  );
}

/**
 * A button's label while its work is under way: the words fade out in place
 * (the button keeps its exact width — no jump) and the two lights take their
 * place. The words stay the accessible name; the button itself says aria-busy.
 */
export function BusyLabel({ busy, onFill = false, children }: { busy: boolean; onFill?: boolean; children: ReactNode }) {
  return (
    <span className="busy-swap" data-busy={busy}>
      <span className="busy-label">{children}</span>
      <CoupleLoader onFill={onFill} className="busy-loader" />
    </span>
  );
}
