# Design review

The standard: software that feels deliberately designed for **this** business — calm, serious,
fast — not a generated SaaS dashboard. Run this review after functionality works, with screenshots at
**390×844** and **1440×900** of every screen, and `/design-system`.

Companion documents: [docs/DESIGN_PATTERN_LIBRARY.md](docs/DESIGN_PATTERN_LIBRARY.md) (patterns and the
quality bar extracted from Koma and Tovli) and [docs/SCREEN_BUILDING_PLAYBOOK.md](docs/SCREEN_BUILDING_PLAYBOOK.md)
(the questions per screen). Screenshots: `npm run qa:screenshots` → `screenshots/qa/{desktop,iphone}`.

## Design skills — what exists and how to use it

Reviewed 2026-09-17. Skills live on a developer's machine (`~/.claude/skills`), not in this repository.
Treat any skill as advice checked against this document; never as permission to override tokens, RTL
rules or accessibility. Never install a skill from a fork or an unreviewed source.

| Skill | Status on the build machine | Source verified | Use here |
|---|---|---|---|
| **Hallmark** | **installed** at `~/.claude/skills/hallmark`, pinned to commit `13ac0ec` (`PROVENANCE.txt` next to it) | `github.com/Nutlope/hallmark` — the original (MIT). `yonisman/hallmark` is a 0-star fork: do not use. Reviewed: 107 markdown files, no scripts, no hooks, no network use except its `study` verb reading a URL you give it | `hallmark audit <paths>` — read-only punch list. Many gates target landing pages (hero, footer, macrostructures, eyebrows); for operational screens use its interaction, state, contrast, token and copy gates |
| **Impeccable** | **not installed** | `github.com/pbakaus/impeccable` (Paul Bakaus, Apache-2.0) | Its markdown guidance (critique, audit, craft floor) was read and folded into the library. Install only by an owner decision — see below |
| Emil Kowalski design engineering | no separate skill; principles implemented | — | §9 motion table + library §16 |
| `web-design-guidelines` (Vercel) | installed | Vercel | interface/accessibility rules; ignore English copy rules (Title Case) |
| `design-taste-frontend` | installed | — | declares itself not for dashboards/tables; anti-slop checks only |
| `redesign-existing-projects` | installed | — | its Latin display fonts and tight letter-spacing are wrong for Hebrew |

**Why Impeccable was not installed.** Its Claude Code integration adds project hooks that run a native
`impeccable` binary after every Edit/Write and on session Stop (`.claude/settings.json` →
`PostToolUse` / `Stop`), and its launcher resolves or caches a platform binary. That is executable
code running continuously in the development environment (it downloads its engine binary into
`~/.impeccable/bin/` on first run); installing it is the owner's decision, not an agent's. Documented
install, from the author's README (verified 2026-09-17):

```bash
# From the project root. Installs the skill AND the provider hook manifest for this project.
npx impeccable install --providers=claude --scope=project
# Alternative: the Claude Code plugin marketplace published in the same repository
#   /plugin marketplace add pbakaus/impeccable
```

Then in Claude Code: `/impeccable hooks status`, and `/impeccable hooks off` unless the team wants the
detector on every edit. Its `/impeccable init` writes `PRODUCT.md` and `DESIGN.md` into the project:
keep them consistent with BUSINESS_BRIEF.md and this document rather than letting them become a
second source of truth.

Use it for `critique`, `audit`, `polish` on screens; keep its hook off unless the team wants a
design detector on every edit. Its "craft floor" bans that matter here are already in this document
(no side-stripe borders on cards, no gradient text, no glass as decoration, one authored motion
moment, theme the browser surfaces).

**Installing Hallmark on another machine** (markdown only; re-review on every update):

```bash
SHA=13ac0ec7e148655948100b6396439e481361d690
gh api "repos/Nutlope/hallmark/tarball/$SHA" > hallmark.tgz && tar -xzf hallmark.tgz
find Nutlope-hallmark-*/skills -type f ! -name '*.md'     # must print nothing
cp -r Nutlope-hallmark-*/skills/hallmark ~/.claude/skills/hallmark
```

**Last reviews of the core UI**
- web-design-guidelines: no `outline-none` without replacement, no `transition: all`, no paste blocking,
  no zoom lock, live regions, touch-action, safe areas, overscroll containment, tabular numbers, URL
  state. Fixed: balanced headings.
- Hallmark audit (2026-09-17, app shell, components, screenshot sweep): 0 critical · 2 major · 1 minor
  fixed — toast colours bypassed tokens; a fast save flashed a spinner; straight quotes in Hebrew copy.
  **Intentional divergences** (operational tool, not a landing page): confirmation dialogs for
  archive/reopen (they capture a reason for the audit log — Hallmark prefers undo); list row titles
  wrap to two lines (identification beats one-line truncation; buttons and nav still never wrap);
  white document surfaces on a tinted canvas (the document is the only white — brand token per
  business); centred empty states (instruction, not decoration).

## 1. Anti-generic check (fail any → not finished)
- [ ] No blue/purple gradients, glow, glassmorphism, neon accents, or "AI sparkle".
- [ ] Not every block is a floating card. Surfaces have edges (rules), shadows only on overlays.
- [ ] No "Welcome back 👋", no fake KPIs, no chart that answers no question anyone asked.
- [ ] No decorative badges, streaks, confetti or gamification.
- [ ] Radii differ by kind (documents square-ish, controls soft, sheets rounder), not 24px everywhere.
- [ ] One accent colour, used for: primary action, focus, current location. Not for decoration.
- [ ] The home screen answers "what do I need to do today?" before "how are we doing?".
- [ ] Copy uses the business's terminology; no "entity", "record", "item" in the UI.

## 2. Hierarchy and typography
- [ ] Each screen has one obvious primary action (or none). Secondary actions are visibly quieter.
- [ ] Hierarchy comes from weight and position first, size second. The type scale in
      `foundation.css` has one job per step; no ad-hoc `text-[17px]`.
- [ ] Body text ≥14px, controls 16px (iOS zoom), labels 13px, metadata 12px, nothing below 11px.
- [ ] Hebrew line-height ≥1.5; no letter-spacing or uppercase on Hebrew.
- [ ] Numbers in tables use tabular figures (`tnum`) and align to the inline end.
- [ ] Contrast AA: body text ≥4.5:1 (`ink-subtle` is the lightest text colour allowed).

## 3. Spacing, alignment, density
- [ ] 4px grid; related things closer than unrelated things; section spacing > row spacing.
- [ ] Rows are scannable: primary text first, metadata second line, amounts/status at the end.
- [ ] Screens are judged with realistic content (longest names, missing values, multi-line notes, overdue
      rows, refunds) in the screenshot sweep, not with short sample data.
- [ ] Density fits the job: office desktop screens can be denser than field-phone screens.
- [ ] Edges align: page header, toolbar, table and section titles share a start edge.

## 4. RTL and mixed direction
- [ ] Layout mirrors correctly (sidebar on the right, chevrons "forward" point left).
- [ ] Logical properties everywhere (`ps/pe/ms/me/start/end`); no `left/right` for layout.
- [ ] Phone numbers, emails, URLs, usernames, ids, amounts are LTR-isolated (`Ltr`, `MoneyText`, `DateText`)
      and do not reorder punctuation ("050-1234567" stays intact).
- [ ] Inputs for Latin content are `dir="ltr"` with `text-start`; adornments sit on the correct side.
- [ ] Stepping through time follows the reading direction: previous at the start edge (right in Hebrew),
      next at the end, chevrons pointing along it — period steppers and pagination alike, one
      convention per product. Chart and timeline AXES may run left → right (how Israeli spreadsheets
      and printed reports draw them); say which in BUSINESS_RULES.md if the business has a habit.
- [ ] Icons depicting objects are never mirrored; directional icons are.
- [ ] Truncation keeps the start of Hebrew text; long Latin strings `break-all` only in dedicated fields.

## 5. Mobile (390px)
- [ ] No horizontal scroll (E2E asserts it on key pages).
- [ ] Bottom navigation ≤4 destinations + "עוד"; current page marked.
- [ ] Touch targets ≥44px; spacing prevents mis-taps on destructive actions.
- [ ] Forms open as bottom sheets; the primary button is reachable above the keyboard (pinned footer).
- [ ] Tables become row lists (`ResponsiveTable` mobile placement), not sideways-scrolling grids.
- [ ] The most frequent field task is possible one-handed.

## 6. Forms
- [ ] Labels above fields, required marks consistent, hints short.
- [ ] Errors appear after blur or submit (never while typing a valid-in-progress value), next to the field,
      in words that say how to fix it; server field errors land on the right field.
- [ ] Correct keyboards: `inputMode` numeric/decimal/tel/email; `autocomplete` for credentials.
- [ ] Submit shows progress, cannot double-submit, dialog cannot close mid-save.
- [ ] Dates use `DateInput` (DD.MM.YYYY + calendar), times `TimeInput` (24-hour HH:MM), money `MoneyInput`
      (₪, exact agorot; a minus sign only where refunds exist).
- [ ] What is on screen is what gets submitted: an unreadable value is shown as invalid, never silently
      replaced by an earlier one.

## 7. Tables and lists
- [ ] Headers are quiet (11px, subtle ink); data is the loudest thing; the header row sticks while scrolling.
- [ ] Sortable columns only where people actually reorder (names, dates, amounts); the active column shows its
      direction and `aria-sort`; phones get the same choices in a sort select.
- [ ] Hover is a background change, not a lift.
- [ ] Empty state says what would be here and how to create it; filtered-empty says how to widen.
- [ ] Totals rows are ruled (double rule for a final total), not coloured.

## 8. Dialogs and bottom sheets
- [ ] Title says what the dialog does; confirm buttons use the verb ("העברה לארכיון", not "אישור").
- [ ] Destructive confirmations explain consequences and whether it is reversible.
- [ ] Focus enters, is trapped, Escape closes, focus returns (E2E asserts).
- [ ] Sheet has a grab handle and drag-to-dismiss on phones; centred dialog from 640px.

## 9. Motion (Emil Kowalski principles, adapted)
Tokens in `foundation.css` (mirrored in `core/ui/motion.ts`, test-enforced):

| Motion | Duration | Easing |
|---|---|---|
| Bottom sheet enter | 340ms | `cubic-bezier(.32,.72,0,1)` |
| Bottom sheet exit | 240ms | `cubic-bezier(.4,0,1,1)` |
| Backdrop | 200ms | linear |
| Dialog enter (scale .98→1 + opacity) | 220ms | `cubic-bezier(.22,1,.36,1)` |
| Dialog exit | 160ms | `cubic-bezier(.4,0,1,1)` |
| Disclosure | 260ms in / 200ms out | enter / exit curves |
| Feedback (hover, press) | 140ms | — |
| Reduced motion | ~120ms opacity only | linear |

- [ ] Motion explains a change of place or state; nothing moves for decoration.
- [ ] Exits are faster than entrances; nothing blocks input while animating.
- [ ] Transform/opacity only (compositor); no animating height of large lists, no blur during motion.
- [ ] Press feedback is subtle (scale .985), never bouncy on operational controls.
- [ ] `prefers-reduced-motion`: movement removed, short fades kept (E2E asserts).
- [ ] Frequent actions (saving a row, switching tabs) are instant; motion is for overlays and disclosure.

## 9b. Accessibility
- [ ] `e2e/<area>/accessibility.spec.ts` runs axe (WCAG 2.1 A/AA) on every screen, including dialogs open.
- [ ] Automated checks are a floor: the keyboard and screen-reader pass in MANUAL_QA.md is still required.

## 10. States and feedback
- [ ] Loading: skeletons shaped like the content; no full-page spinners for partial loads.
- [ ] Errors: human sentence + what to do; never codes or stack traces; the error digest shown only as a reference.
- [ ] Success: a short toast for background confirmation; the changed data itself is the main feedback.
- [ ] Focus visible on every interactive element (2px focus ring or control border + ring).

## 11. Print
- [ ] Print preview shows a document: business identity header, title, metadata, content, footer with time.
- [ ] The header shows the business's real legal name and details — never the template placeholders.
- [ ] No navigation, buttons, badges, or screen-only hints on paper; black on white; rules instead of fills.
- [ ] Table headers repeat per page, rows do not split, the total appears once.

## Giving a business its identity
The foundation's default ("יסוד": stone paper, near-black ink, deep green accent) is a neutral start.
For each project:
1. Find the business's material: what do they already look at all day? (a ledger, a clinic chart, a
   workshop board, a menu). Pick one concept, write it in two sentences at the top of `theme.css`.
2. Choose ONE accent from their existing brand, adjusted for AA contrast; derive tint/text variants.
3. Choose the canvas temperature (warm paper, cool clinical, neutral) to match the concept.
4. Choose a Hebrew typeface with a matching Latin (IBM Plex Sans Hebrew, Rubik, Heebo, Assistant,
   Noto Sans Hebrew, or the brand's licensed face) — change the import in `app/layout.tsx`. Optionally a
   **display face** for titles (`--brand-font-display`: e.g. Frank Ruhl Libre for a law office, Secular
   One for a studio) and the title/section weights and sizes (`--brand-title-weight`,
   `--brand-text-title`, …). Keep hierarchy from weight first; do not jump to 40px numbers.
5. Set radii by kind to match the concept (a ledger is square; a consumer-facing booking tool softer).
   Set **density** (`--brand-row-padding-y`: 0.5rem ledger … 1rem calm) and the **chrome**
   (`--brand-chrome`: surface for a panelled sidebar, canvas so only documents are white).
6. One signature element at most (Koma: the ruled period band). Not ten.
7. Update the logo, favicon and print header. Screenshot every screen; compare with the anti-generic list.
