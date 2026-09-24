# 0016 — Screens push like iOS; a pressed button always answers

Status: Accepted (2026-09-24)

## Context
The seventh iPhone review asked for movement between screens "like Tovli", a visible loader on
every button that waits, and a calmer task row. Tovli (React Native) pushes a stack screen in whole
from the side over ~300ms with an ease-out-cubic curve, mirrored for right-to-left. The earlier
`.page-push` CSS (a 32px nudge on arrival) read as a flicker, not a move, and nothing left.

## Decision
- **Directional screen moves use React's `<ViewTransition>`** (Next 16 App Router, no config),
  through one domain wrapper, `PageTransition`, placed in each page (a layout never unmounts). Links
  that go deeper carry `transitionTypes={['nav-forward']}`, links that return carry `nav-back`;
  anything untagged — tabs, the browser's own back, `router.refresh()` after a tick — does not slide
  (`default: 'none'`), and tabs keep the shell's 160ms opacity settle (ADR 0014). Forward: the new
  screen enters whole from the left while the old drifts 30% and dims; back is the reverse. The top
  bar and tab bar get `view-transition-name`s and are held still. `::view-transition` does not take
  taps. Reduced motion: no movement.
- **One route, two screens** (`/week` and `/week?w=`) are keyed apart so they enter and exit.
- **Opening a task from the list** is the same push (the composer is a top-layer `<dialog>`, so it
  animates itself: `data-kind="push"`). A new task only rises a little: it is opened with the
  keyboard already up, and sliding a focused field in from off-screen would make Safari pan.
- **A button that waits says so in place:** its words fade out and the app's loader (two lights —
  blue for partner A, pink for partner B — circling each other) takes their place at the same size;
  the button keeps its width and is `aria-busy`. It stays busy until the next screen has arrived
  (`useTransition` around `router.refresh()`), not only until the server answered. Core buttons
  keep the core spinner (generic, unchanged).
- **Partner A is blue, partner B is pink** (the owner is always A). The tokens swapped values; the
  lights keep their corners, so no component changed.

## Consequences
- Browsers without view-transition types simply do not animate; nothing depends on the animation.
- A new directional link must be tagged by hand, and its page must use `PageTransition`.
