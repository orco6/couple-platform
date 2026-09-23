# 0014 — Navigation keeps the screen; the tab answers at once

Status: Accepted (2026-09-23)

## Context
On a real iPhone the owner described the product as "jumpy" and "browser-like". Measured causes,
not impressions:

1. **`(app)/loading.tsx` replaced the whole page on every navigation.** Every page is dynamic (the
   CSP nonce), so every tab tap went page → a generic title-and-six-rows skeleton → page, and the
   skeleton's geometry matched none of the screens it stood in for.
2. **`RouteSettle` faded each new page in from opacity 0 with a 4px rise.** Combined with (1) the
   content visibly rebuilt itself. The transform also made the route wrapper the containing block
   of anything `position: fixed` inside a page for the length of the animation.
3. **Where the functions run relative to the database.** The first assumption was that the preview
   database lived in `eu-central-1` and the functions in `iad1`, so every query crossed the Atlantic.
   Measured, it was the other way round: the Neon store's metadata says `iad1`, and moving the
   functions to `fra1` doubled authenticated page times (median ≈ 700ms vs ≈ 350ms, same pages, same
   database, same account).

## Decision
- **No route-level loading boundary under `(app)`.** Navigation keeps the current screen until the
  next one is ready (Next's default without a boundary). A screen that needs a real loading state
  owns one whose geometry matches it; a generic skeleton for the whole app is not allowed back.
- **The tab answers within a frame.** `MobileNav` marks the tapped tab `data-pending` and styles it
  as current immediately, before the next screen arrives, the way a native tab bar does; the mark
  clears when the pathname changes (render-phase, no effect).
- **`RouteSettle` is opacity-only, 0.35 → 1 over 160ms.** Never blank, never moving, never a
  containing block.
- **`NavItem.alsoActiveOn`** (core, generic): a destination that has more than one view (here the
  week and the month) keeps its tab lit on all of them.
- **Functions run in the database's region**, pinned explicitly in `vercel.json` (`iad1` today). If the
  database moves, the pin moves with it — and the check is a measurement, not the dashboard label.

## Consequences
- A slow server response now shows as a tab that is already lit and a screen that has not changed
  yet, rather than a skeleton. If a screen is genuinely slow, that is now visible — and is fixed in
  that screen's data, not hidden behind a placeholder.
- Business chrome can still restyle the shell through `[data-mobile-tab-bar]` and
  `header[data-app-chrome]` (this business hides the top bar on phones — every screen has its own
  title, and the account is in "more").
