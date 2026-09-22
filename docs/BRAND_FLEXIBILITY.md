# Brand flexibility

**Question.** Can two businesses built on this foundation look like different products — not the same
application with another logo — without editing core component logic?

**Boundary.** A business changes only brand-layer files: `src/brand/theme.css` (tokens), `src/brand/brand.ts`
(name, legal identity, locale), `src/brand/Logo.tsx`, `src/app/icon.svg`, and the font import in
`src/app/layout.tsx`. Core components read semantic tokens; they never contain a business's colours,
fonts, radii or density.

## What a brand controls

| Dimension | Token(s) in `src/brand/theme.css` | Range that stays within the design rules |
|---|---|---|
| Colour: canvas, surfaces, ink, rules, accent, status, inverse | `--brand-canvas` … `--brand-on-inverse-*` | one accent; AA contrast recorded next to each value |
| Body typography | `--brand-font-sans` (+ `next/font` import) | a Hebrew face designed with its Latin |
| Title typography | `--brand-font-display`, `--brand-title-weight`, `--brand-section-weight`, `--brand-text-title`, `--brand-text-section` | serif or display face for titles; hierarchy from weight first; titles ~1.375–2.125rem |
| Density | `--brand-row-padding-y` | 0.5rem (ledger) … 1rem (calm); controls stay ≥ 44px regardless |
| Shape by kind | `--brand-radius-chip/control/surface/dialog/sheet` | square documents to soft consumer-facing; never one radius for everything |
| Navigation chrome | `--brand-chrome` | surface (a panel) or canvas (the desk; only documents are white) |
| Scrim, focus | `--brand-scrim`, `--brand-focus` | focus ring ≥ 3:1 |

Added in this phase (defaults reproduce the previous look exactly): display face and heading weights and
sizes, row density, chrome surface. Before, a law office could not set serif titles, a garage could not be
denser than a clinic, and every sidebar was a white panel — the gap between "another logo" and "another
product".

## What a brand deliberately does not control

- Control heights (44px touch floor), focus behaviour, motion timings and reduced-motion handling —
  usability and accessibility floors, not identity.
- Component structure (a table is a table, a dialog is a dialog) and the phone layout rules.
- Arbitrary CSS in components: raw colour classes fail lint; a business that needs a genuinely new visual
  device (Koma's ledger tally) builds it as a domain component from tokens.

This is intentionally not a theme engine: about thirty variables, no runtime switching, no per-component
overrides.

## Proof: five identities, brand-layer files only

Each identity below was applied by writing a token block into `src/brand/theme.css` and changing the font
import in `src/app/layout.tsx`, then **built and run** (production build, E2E database) and captured at
1440px Chromium and iPhone 13 WebKit: sign-in, customer list, customer detail, the gallery's record-state
section and a dialog. The original brand files were restored byte-for-byte afterwards.

| Identity | Fonts (body / titles) | Palette | Shape | Density | Chrome | Contrast (accent text · subtle text · white on accent) |
|---|---|---|---|---|---|---|
| Premium law office | Assistant / **Frank Ruhl Libre** (serif), titles 1.75rem at weight 500 | ivory paper, near-black ink, burgundy `#6b1f2a` | nearly square (2–3px, dialogs 6px) | spacious (1rem rows) | canvas (desk) | 11.1 · 6.0 · 11.3 : 1 |
| Modern dental clinic | Heebo / Heebo 600 | cool clinical white, teal-blue `#0b6a86` | soft (controls 12px, surfaces 14px, sheets 24px, pill chips) | calm (0.875rem) | surface (panel) | 7.3 · 5.1 · 6.1 : 1 |
| Operational garage | Rubik / Rubik 700, section 1rem | workshop grey, safety orange `#a84300` | hard (4px) | **dense** (0.5rem) — 17 customer rows per desktop screen vs 13 for the clinic | canvas | 6.9 · 6.5 · 6.1 : 1 |
| Creative design studio | Heebo / **Secular One** (display), titles 2.125rem | bright paper, cobalt `#2436c4` | square (0px), sheets 16px | spacious (1rem) | surface | 10.0 · 6.1 · 8.8 : 1 |
| Serious real-estate office | Heebo / Heebo 700 | stone, slate green `#2f5145` | restrained (6px) | ledger (0.625rem) | canvas | 10.0 · 5.6 · 8.8 : 1 |

Screenshots: `screenshots/brand/<identity>/` (local, gitignored): `desktop-1-login`, `desktop-2-customers`,
`desktop-3-detail`, `desktop-4-record-states`, `desktop-5-dialog`, `iphone-1-login`, `iphone-2-customers`.
Reproduce: `npm run qa:brand-proof` (`scripts/qa/brand-proof.mjs` — the exact token blocks and font imports of
all five identities; it restores the brand files byte-for-byte and writes `screenshots/brand/results.txt`).

**Findings**
- The five builds read as five products: typography (serif vs display vs sans titles), density (17 vs 13
  rows on the same screen), corners (square to pill), accent and canvas temperature, and whether the
  navigation is a panel or part of the desk — all without touching a component.
- Every variant kept AA contrast for accent text, subtle text and text on accent fills.
- Core component logic did not change for any identity; the only core changes of this phase were adding
  the token hooks (display face, heading weights and sizes, row density, chrome) with defaults identical to
  the previous look.
- **Still the same between identities, by design:** page structure (header, sections, tables), control
  heights, focus and motion behaviour, the phone layout. A business that needs a different *structure* for
  a screen (a ledger tally, a schedule board) builds a domain component from tokens — see pattern library §20.
- **Not covered by tokens:** the logo mark (`src/brand/Logo.tsx`) and favicon — they stayed the
  foundation's in the proof and must be replaced per business; dark themes (possible with the same tokens
  but not verified here); per-business illustration or photography (none in the foundation).
