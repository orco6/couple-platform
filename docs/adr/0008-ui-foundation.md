# 0008 — UI foundation

Status: Accepted (2026-09-16)

## Context
Each business needs its own visual identity; the default look must not read as generated. Koma used
Tailwind with a custom theme and the `motion` library for sheets; Tovli (React Native) provided the
interaction references (sheet timing, alert layout, field states).

## Decision
- **Tailwind 4 with semantic tokens only.** Two layers: raw values in `brand/theme.css` → semantic tokens
  in `core/ui/styles/foundation.css`. The default Tailwind palette is removed (`--color-*: initial`), so
  `bg-blue-500` cannot appear; identity changes are brand-folder changes.
- **Components are few and real.** No headless-UI dependency: native elements (select, checkbox, radio,
  dialog) keep platform behaviour, accessibility and phone pickers.
- **Overlays on native `<dialog>` + CSS transitions**, not a motion library: top layer, inert page,
  Escape handling for free; we add focus trap/restore, scroll lock, exit transitions, drag-to-dismiss.
  One DOM serves bottom sheet (<640px) and centred dialog via CSS. Saves ~40 KB of JS.
- **Motion tokens** fixed in CSS and mirrored in TS with a test.
- **Server components by default**; client components only for interaction (forms, overlays, filters).
- Hebrew-first: `dir="rtl"`, logical properties, LTR isolation components, IBM Plex Sans Hebrew via
  `next/font` (self-hosted).
- Nonce-based CSP requires dynamic rendering for all pages — acceptable for authenticated apps.

## Consequences
- Complex widgets (combobox with search, date range, rich text) are not included; add per project,
  preferably built on native elements or a small, accessible dependency with an ADR.
- Dark mode is not provided; tokens make it additive (`@media (prefers-color-scheme)` over brand values).
