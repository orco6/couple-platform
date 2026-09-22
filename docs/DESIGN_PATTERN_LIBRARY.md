# Design pattern library

The practical reference for building screens on this foundation. Patterns were extracted from two
shipped products and checked against the foundation's own tests and screenshot sweep:

- **Koma** (`baks`) — an internal monthly-ledger tool for a real-estate office. Next.js 15. Its
  `DESIGN.md` and `IDENTITY.md` record *measured* design decisions (type scale audits, frame rates,
  press timing) and the bugs found by looking.
- **Tovli** (`shayandor`) — a consumer marketplace: an Expo / React Native app (bottom sheets,
  keyboard handling, tab bar) and a small web admin. Its patterns are translated to the web here,
  never copied as code.

Each pattern says what to do, why, how it is implemented here, what not to do, where it came from,
and whether it lives in **core** (use it, do not rebuild it) or is a **domain** decision.

Read with: [SCREEN_BUILDING_PLAYBOOK.md](SCREEN_BUILDING_PLAYBOOK.md) (the questions per screen),
[../DESIGN_REVIEW.md](../DESIGN_REVIEW.md) (the review checklist), `/design-system` (every component
in its states), `npm run qa:screenshots` (the render).

---

## 0. Extraction record

What was found in Koma and Tovli, and what the foundation did with it. "Evidence" is what justified
the action — a measurement, a reproduced bug, or a test that fails when the change is reverted.

| Pattern | Source | Why it works | Use when | Not when | Generic version | Security / UX | Foundation action |
|---|---|---|---|---|---|---|---|
| Asymmetric press: 40ms down, 200ms release | Koma `Button.tsx` (Tovli `Pressable` swaps style instantly) | A symmetric 140ms transition never reaches its pressed scale in an 80–120ms tap: the press does not register | every button and icon button | — | `button-styles.ts`, IconButton | — | **improved existing component** |
| Loading keeps width | Koma `Button.tsx` | Adding a spinner beside the label resizes the button mid-click and shifts neighbours | every async action | — | spinner overlaid, label fades after 150ms | stays focusable (aria-busy, not disabled) | **improved** (E2E measures width and delay) |
| One filled button per view | Koma button system | Fill means "this commits"; a row of filled buttons has no hierarchy | all screens | — | `variant="primary"` once | destructive is `danger`, never primary-coloured | already covered (documented below) |
| Submit never disabled for invalid input | Koma `LoginForm` (from Tovli) | A disabled button that will not say why wastes time; pressing reveals every problem | forms | a button disabled by *permission* or *state* (then say why) | `useSubmit` focuses first invalid control | — | already covered + **improved** (focus/first error) |
| Error shows after blur, 800ms debounce, clears instantly | Tovli `ProfileCompletionScreen`, Koma `useValidatedField` | Typing the first letter is not met with an error; fixing it removes the red at once | client-side live validation | server validation (shown after submit) | server errors clear on edit: `clearOnInput` | — | **improved** (clearFieldError existed, no form used it) |
| Password manager / pre-hydration values | Koma `useAdoptExistingValue` | Autofill can fill fields without events React sees | credential forms | — | `core/ui/form-values.ts` `submittedValue` | reproduced here: filled fields answered "fill in username and password" | **added primitive** (E2E) |
| Forms never submit as GET | (found while checking the above) | Before hydration, Enter submits natively; GET puts fields in the URL | every form | — | `method="post"` + ESLint rule | reproduced: `/login?username=…&password=…` | **added lint rule** (E2E, security) |
| One overlay: sheet on phones, dialog from 640px | Koma `Sheet.tsx`, Tovli sheets | A sheet sliding up a 1400px screen is a phone gesture on a desktop | every modal | full pages for long work | `Dialog presentation="auto"` | — | already covered (native `<dialog>`, stronger than Koma's) |
| Asymmetric overlay motion (in soft, out decisive) | Tovli sheet: spring in, 260ms ease-in out; Koma measured | A symmetric spring reads rubbery on exit | overlays, disclosures | page content | motion tokens in `foundation.css` | reduced motion: fade only | already covered |
| Close first, then open the next overlay | Tovli `OptionsBottomSheet close(afterClose)`, `AppAlert` settle queue | Two overlays animating together reads as a glitch | menu item → dialog, form → success | — | `Dialog onExited` | — | **added prop** (E2E fails when reverted) |
| Actions pinned above the keyboard / safe area | Tovli keyboard controller, Koma sheet footer | The primary action must stay reachable while typing | dialogs with forms | — | Dialog `footer` (pinned, `pb-safe`) | — | already covered |
| Tab bar steps aside while typing | Tovli `TabBarVisibilityContext` | On Android a fixed bar rides above the keyboard over the field | phone shell | — | CSS `:has(input:focus)` hides `[data-mobile-tab-bar]` | — | **improved shell** (E2E) |
| Page padding reserves the tab bar | Tovli `useTabBarHeight`, Koma | The last row must not hide under the bar | phone shell | — | `main pb-28`, `scroll-padding-block` | — | already covered + **improved** (scroll padding) |
| Short route settle (180ms, 4px) | Koma `ViewTransition` | A hard DOM swap feels abrupt next to overlay motion | page changes | filter/sort changes (search params) | `RouteSettle` keyed on pathname | none with reduced motion | **added** |
| Two presentations of a table | Koma `EntryList` (Tovli feed rows) | A 5-column financial table at 390px is sideways scroll or unreadable | lists with ≥3 columns | 1–2 column lists (just a list) | `ResponsiveTable` | — | already covered + **improved** (null cells, 2-line titles) |
| Hairlines, not boxes; box only discrete objects | Tovli (separators outnumber surfaces; feed rows unboxed), Koma identity audit | Boxing everything at one radius was the "generated" look | all screens | a record's details, a form, a table (document-like units) | `surface`, `divide-rule-faint`, `Section` without card | — | already covered |
| Quiet ordinary states, chips only for movement | Koma `StatusChip` audit (four identical "draft" pills) | Colour everywhere means colour nowhere | status columns | — | `StatusBadge` neutral/muted = text | colour never the only signal | **improved** (E2E) |
| Empty state = instruction, no icon circle | Koma `EmptyState` | Icon-in-tinted-circle is on every generated empty state and says nothing | every list | — | `EmptyState` with required description | — | **improved** (dashed box removed) |
| Start-edge state rule on exception rows | Koma ledger rows | Texture until one differs | dense ledgers with one exception kind | cards, notices, callouts (Hallmark gate 5, Impeccable: side-stripe is an AI tell) | domain CSS on rows, always with a word | never colour only | **documentation only** (conflicting evidence) |
| Time steps follow reading direction | Koma `MonthSelector` (previous at the start edge, chevron pointing back) | Mirroring the Latin convention sends Hebrew readers backwards; pagination already worked this way | period steppers, pagination | chart axes (may stay left → right) | `ChevronBackIcon` / `ChevronForwardIcon` at start / end | — | **fixed sample** (it contradicted the core pagination) |
| Anchor scroll margin under sticky bars | Koma `CollapsibleSection scroll-mt-20` | A link to a section lands under the sticky bar | anchored sections | — | `scroll-padding-block` on phones | — | **improved** |
| Deactivate, never delete, and say what stays | Koma `UsersBoard` | "Remove" read as "erase" makes admins keep ex-employees active | user and record removal | — | `ConfirmDialog` body names consequences | revocation of sessions | already covered |
| Session ended: do not throw away the form | (both apps redirected to sign-in) | A redirect loses what was typed | writes | data loads (redirect is fine) | `SessionNotice`, sign-in in a new tab | — | **added** (E2E) |
| Capability flags match the server | Koma month close control | Offering an action the server refuses is false confidence | locked periods, archived records, peer admins | — | view `permissions` + reason on screen | server stays authoritative | **improved sample** (closed month; integration test) |
| Capture harness at desktop + iPhone WebKit | Koma `tools/capture.mjs` | Design judged against the render; WebKit caught bugs Chromium did not | every UI change | — | `npm run qa:screenshots` | — | **added** (found a CSP bug on WebKit) |
| Motion probe (sample transform per frame) | Koma `tools/motion-probe.mjs` | "Does it snap" answered with numbers | tuning a new animation | routine screens | documentation only (Playwright `getAnimations`) | — | documentation only |
| Staggered row entrance (28ms per row) | Tovli admin `UsersPage` | — | — | business lists: delays data that already arrived | — | — | **rejected** |
| App-wide blocking loader ("טוען...") | Tovli `LoaderContext` | — | — | business tools: blocks everything for one request | per-control loading, skeletons | — | **rejected** |
| Global alert queue with platform settle timings | Tovli `AppAlert` (450ms iOS modal settle) | RN modal transition limitation | — | web: native `<dialog>` stacks correctly | `onExited` covers sequencing | — | **rejected** (not needed on web) |
| Valid-field green check | Tovli, Koma `Field` | Confirmation, not only absence of complaint | consumer sign-up flows | operational forms filled dozens of times a day (noise) | — | — | **domain decision**, not in core |
| Brand hue, Rubik, folded-paper motif, ledger tally | Tovli / Koma identity | Belongs to those products | — | — | each business defines its own (brief §18) | — | **rejected for core** (brand) |

Conflicts between sources are resolved explicitly, not by picking silently: the start-edge rule
(Koma) versus the side-stripe ban (Hallmark, Impeccable) → allowed only on dense ledger rows, only
for the exception, always with a word; never on cards, notices or alerts.

---

## 1. Buttons

**Purpose.** Tell people what will happen and make exactly one action obviously primary.

**Recommended behaviour**
- One `primary` per screen or dialog: the action that commits. Everything else `secondary` (a real
  alternative) or `quiet` (cancel, dismiss, low-weight toolbar actions). `danger` only where the verb
  destroys or removes, and never more than one per view.
- Label = the verb and the object in the business's words: "הוספת הלקוח", "סגירת החודש". Not "אישור",
  "שמירה" alone when two things could be saved, never "Submit".
- Press feedback is immediate (40ms) and releases softly (200ms). Scale .97 buttons, .94 icon buttons.
- Loading: `loading` prop. Width never changes; label stays 150ms, then the spinner. `aria-busy`, still
  focusable, clicks ignored (duplicate-submit defence with the idempotency key behind it).
- Disabled only when the action is impossible *and* the reason is visible nearby ("החודש סגור…").
  Invalid input is not a reason to disable a submit button.
- Touch target ≥ 44px (`md`). `sm` (36px) only in dense desktop toolbars.
- Icon buttons always have `label` (becomes `aria-label` and `title`).
- Action rows in dialogs: Cancel first in the DOM (start edge), confirm at the end, equal widths on
  phones (`flex-1`).
- Long Hebrew labels: design the row to fit (gallery "מסך צר" check). Buttons do not wrap
  (`whitespace-nowrap`); if a label does not fit at 320px, shorten the label or stack the row.
- Navigation that looks like a button is `ButtonLink` (a real link: new tab, copy address).

**Anti-patterns:** several filled buttons in a row; red "delete" styled as primary colour; spinner
that replaces the label ("טוען…" resizing the button); `transition-all`; hover scale; a disabled
button with no explanation; an action rendered for a role that the server will refuse.

**Core:** `Button`, `IconButton`, `ButtonLink`, `button-styles.ts`. **Domain:** labels, which action is
primary.

---

## 2. Forms

**Purpose.** Collect correct data quickly, many times a day, on a phone or at a desk.

**Recommended behaviour**
- `<form method="post" onInput={clearOnInput} noValidate onSubmit=…>` — lint enforces `method`.
- Every field in `FormField` with `name` = the request field (server error key). Label above, required
  mark `*` (not in the accessible name), hint below, error replaces the hint.
- Server errors appear after submit on the right field; focus moves to the first invalid control;
  editing the field removes its error immediately. A server error for a field the form does not show
  becomes the form error (never silent).
- `FormError` for form-level problems (stale write, closed period, session ended) — in words that say
  what to do next.
- Group long forms with `FormSection` (a rule between groups, not cards). Long work (> ~8 fields,
  multi-step, needs reference material) is a full page, not a dialog.
- Correct keyboards: `inputMode` numeric/decimal/tel/email, `autoComplete` for names, phones,
  credentials; `dir="ltr"` + `text-start` for phones, emails, usernames, ids, amounts.
- Controls are 16px on phones (no iOS zoom), 44px tall, same height as the buttons beside them.
- Border width never changes between states; state is colour + focus ring.
- Read-only (e.g. closed period) looks read-only (sunken fill) and stays copyable.
- Credential forms read `submittedValue(form, name, state)` at submit (autofill).
- Double submit: `useSubmit` ignores re-entry; the idempotency key replays the first result.

**Anti-patterns:** validation on every keystroke shown immediately; "required" on a field the person
is still typing into; placeholder as label; disabled submit; floating labels; a form in a dialog that
scrolls behind the keyboard; reading values only from React state in a sign-in form.

**Core:** `FormField`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `useSubmit`,
`form-values.ts`. **Domain:** fields, grouping, labels, hints.

---

## 3. Inputs with meaning (dates, times, money, passwords)

- **Dates:** `DateInput` — DD.MM.YYYY typed or picked; `1/10/2026` → `01.10.2026`; impossible dates
  are errors, never rolled over; value is a `CalendarDate`.
- **Times:** `TimeInput` — 24-hour HH:MM text (native time inputs show AM/PM on English machines);
  `9:05` normalises; unreadable shows invalid and gives the form `''`, never the previous time.
  Combine with the date on the SERVER (`localToInstant`).
- **Money:** `MoneyInput` — shekels typed, agorot stored; `allowNegative` only for refunds; a minus
  is never silently dropped.
- **Passwords:** `PasswordField` — show/hide as an icon in the trailing slot (inside the control's
  own direction), paste cleaning of invisible characters, `autoComplete` current/new.

**Rule:** what is on screen is what gets submitted. An input that keeps a stale value while showing
an invalid one is a data-integrity bug. It happened in `TimeInput`, `MoneyInput` and `DateInput`
(changing `30.04.2026` into `31.04.2026` kept 30.04 in the form) and each is now tested.
Implementation for any custom input: on every change report the parsed value or the empty value
(`''`/`null`) — never skip the call when parsing fails — and when adopting a value from the parent,
compare it with what the current text parses to (unreadable = empty) so your own empty echo does not
wipe what the person typed.

---

## 4. Dialogs

**Purpose.** A short task that must not lose the page behind it, or a decision that needs focus.

**Recommended behaviour**
- `Dialog` (auto: sheet < 640px, centred dialog ≥ 640px). Title says what it does; `description` is
  one line of context, not instructions.
- Three ways out: Escape, backdrop, close button. `dismissible={!pending}` while saving.
- Focus enters the body's first field (never the close button); Tab is trapped; focus returns to the
  trigger.
- Footer pinned; long content scrolls inside the body (`dialog-long` in the gallery).
- Opening another overlay from inside one: close, then open in `onExited`.
- `ConfirmDialog` only when the action is destructive, irreversible, affects other people, or needs a
  reason for the audit log. Body names consequences and what stays ("ההיסטוריה נשמרת"). Confirm label
  = the verb. Cancel has initial focus.

**When not to use a dialog:** a task that needs neither interruption nor protected focus (edit inline
or on a page); long or multi-step work (full page); reversible single-click toggles (just do it; show
the result).

**Anti-patterns:** "?האם אתה בטוח" with Yes/No; confirmation for every save; two overlays animating
together; a dialog that can be closed mid-write; centred modal on a phone.

**Core:** `Overlay`, `Dialog`, `ConfirmDialog`. **Domain:** when to confirm, the words.

## 5. Bottom sheets

- `BottomSheet` = sheet at every width: action menus, pickers, the phone "more" menu.
- Grab handle; drag down to dismiss (velocity or 30% height); upward drag resists.
- Items ≥ 48px tall, full-width tap areas; destructive item last, in danger text, and confirmed.
- Safe-area padding at the bottom; `overscroll-contain` inside.
- Choosing an item that opens something else: close, then `onExited`.

---

## 6. Navigation

**Recommended behaviour**
- `src/domain/navigation.ts` per business: filtered by permission (UX only — pages guard themselves).
- Desktop: sidebar at the inline start, grouped (work / management / personal), current page marked
  with `aria-current` and a visible state.
- Phone: bottom bar ≤ 4 destinations + "עוד" sheet. The four are what the role opens during the day;
  configuration and forensics (audit, settings) live under "עוד" (Koma: admins get four, config via
  the account menu).
- Short per role. A person with one job should see that job, not twelve destinations.
- Detail pages carry a way back (`PageHeader eyebrow` link to the list) — navigation context, not a
  decorative kicker.
- Unavailable routes are absent, not disabled; typing their URL shows the not-found screen.
- Tab bar steps aside while typing; route change settles in 180ms.

**Anti-patterns:** every entity as a top-level destination; admin items shown and failing on click;
breadcrumbs three levels deep in a two-level app; hamburger on desktop.

---

## 7. Tables and dense data

**Recommended behaviour** (`ResponsiveTable`)
- Desktop: a real `<table>` with a caption, quiet headers (11–12px, subtle ink), sticky header row,
  hover as a background change. Data is the loudest thing.
- Numbers: `numeric: true` (end-aligned, tabular figures), `MoneyText`, `DateText` (LTR-isolated).
- Missing values: the cell returns `null`; desktop shows a quiet dash, the phone row omits it.
- Phone: each row becomes a block — `primary` (wraps to 2 lines before truncating), `secondary` values
  on one line joined by " · ", `end` for amount/status, `hidden` for what does not matter on a phone.
- Sorting: server-side via URL, allow-listed keys (`parseSort`), `aria-sort`, `{ id: 'asc' }`
  tie-breaker, `SortFilter` for phones; only on columns people actually reorder.
- Filtering: URL state (`FilterBar`); on phones search on its own row, selects share a row.
- Clear filters: `<ClearFilters pathname params filters={['q', 'owner']} />` next to the filters and as
  the action of the filtered-empty state. Only query parameters that *filter* are cleared — a status tab
  or sort order is navigation and stays.
- Controls follow the URL: after "clear filters" or the browser's back button, the search box shows what
  the list is actually filtered by (it used to keep the old text).
- Pagination: cursor; lists are capped (50–100 rows), not virtualised.
- Status column: quiet text for ordinary states, chips for states that moved.
- Overdue / exception: a word ("באיחור") plus colour; optionally a start-edge rule on dense ledgers.
- Row actions: primary action is the row link; destructive row actions live on the detail page or in
  a sheet, not as a column of red icons.
- Totals: a ruled total row (double rule for the final figure), not a coloured box.

**Do not** replace a dense business table with cards on desktop. **Do not** make phones scroll a
wide table sideways.

**Core:** `ResponsiveTable`, `FilterBar`, `SearchFilter`, `SelectFilter`, `SortFilter`,
`CursorPagination`, `sorting.ts`. **Domain:** columns, placement, sort keys.

## 8. Lists (non-tabular)

- `surface divide-y divide-rule-faint` with rows: title (row text, medium), metadata line (label size,
  muted), end-aligned figure or status.
- Discrete objects (a conversation, a document) may be cards; rows of a feed or ledger are not.
- Master–detail split (list + inspector) is a desktop pattern for review queues (Tovli admin); on
  phones the detail is a page.

---

## 9. Empty states

Every `EmptyState` answers three questions (the `description` prop is required):
1. **What is missing** (title): "עדיין אין לקוחות".
2. **Why it matters / why it is empty**: "לקוח שנוסף מופיע כאן עם הטלפון והמשימות שלו."
3. **What to do**: the one action (if the viewer may), or how to widen a filter.

Filtered-empty is different from never-had-data: say how to widen the search. Day-one empty states
are the product's first impression — write them for that. No illustrations, no icon circles, no
dashed boxes, no jokes.

## 10. Loading

- Page loads: `loading.tsx` skeletons shaped like the content (`LoadingState`), not spinners.
- Actions: the button's own loading state. Never an app-wide blocking loader.
- Short operations do not flash (150ms delay before a spinner).
- Filters: the search icon becomes a spinner while the list refreshes (after 150ms), `aria-busy` on the
  control; old results stay until new ones arrive (no blank flash).
- After a save: the dialog closes when the server confirmed; `router.refresh()` re-renders the list with
  the new data; a toast only if the change is not visible where the person is looking.
- Destructive and confirmation actions: the confirm button carries the loading state; the dialog cannot
  be dismissed until the server answers.
- What is *not* in the foundation on purpose: optimistic list updates. Business data is shown as the
  server stored it (validation, scoping and period locks decide), so lists update after the response.

## 11. Errors

Differentiate — each has a different next step:

| Kind | Where it shows | Words (core copy) | Next step offered |
|---|---|---|---|
| Validation | on the field; focus moves there | how to fix ("יש לכתוב בתבנית DD.MM.YYYY") | edit (error clears on edit) |
| Business rule (closed period, conflicting state) | `FormError` near the action | what blocks it and who can change it | reopen with reason / contact |
| Stale write (409) | `FormError` | "הנתונים שונו בינתיים על ידי מישהו אחר" | refresh |
| Permission (403) | `FormError`; the action should not have been offered | "אין הרשאה לבצע את הפעולה הזו" | none — fix the capability flag |
| Not found / out of scope (404) | page: not-found screen; API: status | "הפריט המבוקש לא נמצא" | back to the list |
| Session ended (401) on a write | `FormError` + `SessionNotice` | "מה שהוקלד עדיין כאן" | sign in in a new tab, save again |
| Session ended on a load | redirect to sign-in with `next` | — | returns to the page |
| Offline / network | `FormError` | "אין חיבור לשרת…" | retry (same idempotency key) |
| Unexpected (500) | `FormError` / `error.tsx` | generic, no codes, no stack | retry; digest only as a reference |
| Rate limited (429) | `FormError` | when it can be tried again ("אפשר לנסות שוב בעוד כמה דקות") | wait; no retry loop |

Errors are never only in a toast: a toast disappears before people read it, and screen-reader users
may miss it. Toasts are for successes that are not visible where the person is looking.

Error colour is for things that are wrong. An expected, ordinary state (waiting for an invoice) is
amber or text, never error red (Koma: red on ordinary states teaches people to ignore red).

## 12. Confirmations and destructive actions

**Trigger styling (one rule for the whole app):**
- Reversible removal (archive, cancel with restore): `quiet` button, neutral text — "לארכיון".
- Removal the UI cannot undo, or that cuts someone's access at once (delete a note, deactivate a user):
  `quiet` button with danger text — "מחיקה", "השבתה".
- Either way the action is confirmed in `ConfirmDialog`, where the filled `danger` button lives. A filled
  red button never sits on the page itself.
- Row-level triggers are real `Button`s (press feedback, focus ring), 44px tall on phones.


- Prefer reversible actions with a visible result over confirmations.
- Confirm when: irreversible, removes something others rely on, affects money or a closed period, or
  a reason must be recorded. Archive with a reason is a confirmation because the reason is data.
- Body: consequence + what stays + reversibility. Button: the verb. Cancel focused.
- Destructive actions are not offered to roles that cannot perform them.

## 13. Toasts

- For effects that are not visible where the person is looking: a dialog closed and the change is
  elsewhere, other sessions were signed out, a follow-up was created on another screen.
- Not for inline edits whose result is visible. Not for errors that belong to a field or form.
- Polite live region; pauses on hover/focus; 5s; never shifts layout; bottom on phones above the tab
  bar.

---

## 14. Mobile

- Designed at 390px first; verified on iPhone WebKit in the sweep (not a resized Chromium).
- Thumb zone: primary actions at the bottom of sheets; tab bar for daily destinations.
- 44px targets; 16px controls; no zoom lock ever.
- Forms in sheets with a pinned footer; the tab bar steps aside while typing.
- Safe areas: `pb-safe` on bars and sheet footers.
- No sideways scrolling anywhere (E2E and sweep fail on it).
- A production build over plain http (testing on a phone via LAN) must hydrate — the CSP only asks
  for HTTPS upgrades on HTTPS pages.
- Gestures always have a tap alternative (drag-to-dismiss has Escape, backdrop and close).

## 15. RTL and mixed direction

- `<html lang="he" dir="rtl">`; logical properties only (`ps/pe/ms/me/start/end`).
- Latin and numbers inside Hebrew: `Ltr` / `MoneyText` / `DateText` / `PhoneLink` (`<bdi dir="ltr">`)
  so "050-1234567" and "₪1,180" never reorder.
- LTR inputs set `dir="ltr"` on the control and the wrapper (adornments on the correct side).
- Long emails and URLs wrap after `@`, dots and slashes (`EmailLink` inserts `<wbr>`), never between any two
  letters (`break-all` turned "…org.il" into "…org.i" / "l" on a phone).
- Stepping through time follows reading direction: previous at the start edge (right), next at the
  end, chevrons along it — period steppers and pagination use the same convention (Koma's month
  stepper; Hebrew calendars). Chart/timeline axes may run left → right; be consistent within a product.
  (The foundation's sample originally forced previous-on-the-left while its own pagination did the
  opposite; fixed during this extraction.)
- Directional icons mirror; object icons do not.
- No letter-spacing or uppercase on Hebrew; body line-height ≥ 1.6.
- Hebrew quotation marks and abbreviations use gershayim/geresh (״ ׳).

## 16. Motion (Emil Kowalski principles, as implemented)

- Motion explains a change of place or state; nothing moves for decoration.
- Tactile: press lands immediately (40ms), releases softly (200ms). Hover is colour, not movement.
- Overlays arrive softly and leave decisively (sheet 340ms in / 240ms out; dialog 220/160ms).
- A sheet slides (transform only — no fade on a large subtree: Koma measured it halving frame rate);
  a centred dialog resolves in place (opacity + 2% scale).
- Interruptible: reopening during an exit goes straight back to open.
- Page change: 180ms settle, no exit animation — never make people wait for data that has arrived.
- Reduced motion neutralises movement (fades only), it does not just shorten it.
- Focus rings appear instantly. No bounce/overshoot on UI state. No scroll-triggered entrances, no
  staggered list reveals.
- New animation? Sample it (`element.getAnimations()`, or a per-frame transform probe) before trusting
  a number in the source.

## 17. Accessibility

- Semantic elements first (`button`, `a`, `table`, `dialog`, `fieldset/legend`, `label`).
- Every control labelled; errors linked with `aria-describedby`; invalid with `aria-invalid`.
- Live regions: toasts polite, errors `role="alert"`, session notice alert.
- Skip link; visible `:focus-visible` everywhere; focus management in overlays.
- Contrast recorded next to every brand token (AA body text).
- Colour is never the only signal (status words, overdue words, printed "missing").
- axe WCAG 2.1 A/AA in E2E for core pages, gallery and each business area.

## 18. Print

- A separate route (`src/app/print/(area)`) with `PrintLayout`, not the screen with navigation hidden.
- Business identity header from `brand.ts` (placeholder contact fields are omitted, never printed).
- A4, rows do not split, header row repeats, total once with a double rule.
- Words instead of colour ("חסרה", not an amber tint). No buttons, badges or screen-only hints.
- Sensitive fields a role may not read never reach paper (clinic test: no clinical notes in print).

## 19. Security-sensitive UX

The backend is the boundary. The UI's job is to never create false confidence.

- **Hidden actions:** views carry `permissions` flags computed on the server from the same rules the
  service enforces. Tests assert the flags match what the service accepts (closed month: no status,
  price or assignee actions; peer admin: `manageable`).
- **Closed / locked / archived records:** `<Notice>` says why on screen for as long as it is true
  ("08/2026 סגור: הסטטוס, המחיר והאחראי נעולים עד שהחודש ייפתח מחדש."), the actions the server would refuse
  are not rendered, and edits that are still allowed stay available. Read-only fields use `readOnly`
  (dashed edge, no fill), not `disabled` (still copyable, still announced; disabled is a sunken fill).
- **Disabled vs absent:** absent when the role can never do it; disabled only with the reason next to it
  when the same person could do it after something changes.
- **Destructive admin actions:** confirmation names consequences (sessions ended, data kept).
- **Sensitive fields:** absent from the view, the print page and the API response — not hidden in JSX.
- **Session expiry:** writes keep the form; loads redirect with `next`.
- **Passwords:** never logged, never in URLs (`method="post"`), temporary passwords shown once.
- **Duplicate submissions:** loading button + `useSubmit` guard + idempotency key replay.
- **Stale edits:** `version` on the record; 409 with a refresh instruction.
- **Out of scope:** not-found, not "access denied" (does not confirm the record exists).

---

## 19b. Component state reference

Which states each shared control has, and how each is shown. Build new components to the same table.

| Component | default | hover | focus | pressed | disabled | loading | error | read-only | empty | other |
|---|---|---|---|---|---|---|---|---|---|---|
| Button / IconButton | variant fill or rule | colour change | 2px focus ring, instant | scale .97/.94 in 40ms | opacity .55, not-allowed | label kept 150ms then spinner, width fixed, `aria-busy`, focusable | — | — | — | `danger` only for destructive verbs |
| Input / Textarea / Select | rule-strong border | darker border | accent border + ring | — | sunken, subtle text | — | danger border, message under field, `aria-invalid`, focus moves here after submit | dashed edge, no fill, focusable (text inputs only) | placeholder only as an example | constant 1px border in every state |
| DateInput / TimeInput / MoneyInput | as Input, LTR | as Input | as Input | — | as Input | — | shown after leaving the field; form value becomes empty | as Input | `''` / `null` | never hold a stale value |
| FormField | label + hint | — | — | — | — | — | error replaces hint | — | — | required mark not in accessible name |
| Dialog / BottomSheet | — | — | focus in first field, trapped, restored on close | — | close disabled while saving | footer button loading | `FormError` in the body | — | — | `onExited` for the next overlay |
| ConfirmDialog | cancel focused | — | — | — | confirm disabled until a required reason exists | confirm loading, not dismissible | `FormError` | — | — | body names consequences |
| ResponsiveTable / list rows | rows | background tint | link focus ring | — | — | page skeleton | page error | — | `EmptyState` (never-had-data vs filtered) | null cells: dash on desktop, omitted on phones |
| SearchFilter / SelectFilter | — | — | accent border | — | — | spinner after 150ms, `aria-busy` | — | — | — | follows the URL |
| StatusBadge | quiet text (neutral, muted) or chip (moved states) | — | — | — | — | — | `danger` chip | — | — | colour never the only signal |
| Notice | neutral tint | — | — | — | — | — | — | — | — | `warning` only when someone must act |
| EmptyState | title + why + action | — | — | — | — | — | — | — | — | action absent when the viewer may not create |

Screen-level states (unauthorized → not-found or absent action; archived; stale/conflict; session ended)
are in the playbook's state matrix and §11/§19. The gallery (`/design-system`) renders every row of this
table, including "מצבי רשומה ושגיאות" for archived, locked, conflict, network, server, rate-limit and
session-ended states.

## 20. Visual intelligence — questions that made Koma stop looking generated

From Koma's `IDENTITY.md` second pass, generalised:

- **What is visually dominant?** One figure or one list per screen. If four things compete, it reads as
  a dashboard template.
- **Hierarchy from weight, not size.** Tovli tops out at 20–22px and uses weight 600 heavily; Koma's
  generated look came from a 40px number over 16px everything else. Keep the type scale small; use
  weight and rules.
- **Stat strips are sentences.** "7 נכסים · ₪33,040 נגבה · ₪3,540 ממתין לחשבונית" instead of four
  label-over-value boxes.
- **Do not print the same fact twice** (a month as heading and again inside a selector).
- **One sheet per screen, ruled internally** — sections separated by rules and headings, not stacked
  cards.
- **Shadows only on things that float** (overlays, toasts). Rules do the work shadows were doing.
- **Radius by kind:** documents ~6px, controls ~10px, sheets ~20px. One radius everywhere is a tell.
- **One accent**, used for the primary action, focus and current location — not decoration. The sign-in
  screen may be the one loud moment.
- **Measure, do not guess:** count type sizes and text colours on a rendered screen; ad-hoc sizes
  (`text-[15px]`) are drift. Raw colour classes (`text-[#...]`) fail lint: colours come from tokens.
- **What makes it this business:** its own nouns, its recurring object (the month, the appointment,
  the work order) given a consistent visual treatment, and figures set the way that trade sets them.
