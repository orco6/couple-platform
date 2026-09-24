import { ViewTransition, type ReactNode } from 'react';

/**
 * How a screen arrives and leaves, as in Tovli: a link tagged `nav-forward`
 * (going deeper) pushes the new screen in from the left; `nav-back` takes it
 * away again (styles.css, "Moving between screens"). Anything untagged — a
 * tab, the browser's own back, a refresh after a tick — does not slide here;
 * the shell's short fade covers tabs. It lives in each page, not a layout:
 * a layout never unmounts, so it would never enter or exit.
 */
const MOVES = {
  'nav-forward': 'nav-forward',
  'nav-back': 'nav-back',
  default: 'none',
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={MOVES} exit={MOVES} default="none">
      {children}
    </ViewTransition>
  );
}
