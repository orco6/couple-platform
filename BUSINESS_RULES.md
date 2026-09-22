# Business rules — שנינו (couple-platform)

The contract between the product, the code and the tests. Every rule has an ID, a source and a test
that proves it. The rule ID appears in the service comment and in the test name.

Rule IDs: `R-<AREA>-<NN>`. Areas: `TASK` (the shared list), `DAY` (closing the day and the reveal),
`SUM` (summaries), `CALC` (calculations), `ACC` (access), `SET` (settings).

---

## 0. Sources

| Date | Source | Topics |
|---|---|---|
| 2026-09-22 | Product owner's written mandate (product mode + the initial feature list) | Everything: product identity, the two ratings, the reveal, the summaries, the design bar, Hebrew-first with i18n-ready structure, stack constraints |
| 2026-09-22 | `BUSINESS_BRIEF.md` (written from that mandate) | All sections below |

---

## 1. Roles and permission matrix

| Capability | Permission key | OWNER | PARTNER | Rule ID |
|---|---|---|---|---|
| See the shared list | `tasks.read` | ✓ | ✓ | `R-ACC-01` |
| Add a shared task | `tasks.create` | ✓ | ✓ | `R-ACC-01` |
| Edit a shared task | `tasks.edit` | ✓ | ✓ | `R-ACC-01` |
| Complete / reopen any task | `tasks.complete` | ✓ | ✓ | `R-TASK-03` |
| Archive / restore a task | `tasks.archive` | ✓ | ✓ | `R-TASK-05` |
| Submit own day entry | `day_entries.submit` | ✓ | ✓ | `R-DAY-01` |
| Read own day entry | `day_entries.read` | ✓ | ✓ | `R-DAY-04` |
| Read the partner's day entry | *no permission — state, not role* | after the reveal only | after the reveal only | `R-DAY-05` |
| See the summaries | `summaries.read` | ✓ | ✓ | `R-SUM-01` |
| Change shared settings | `settings.manage` (core) | ✓ | — | `R-SET-01` |
| Manage users / reset passwords | `users.manage` (core) | ✓ | — | `R-ACC-02` |
| Read the audit log | `audit.read` (core) | ✓ | — | `R-ACC-03` |

**Management hierarchy.** `OWNER` covers `PARTNER`; `PARTNER` covers nothing. So the OWNER may invite,
reset and disable the second partner, and the second partner may do none of that. Proven by a unit
test on `roleCovers` (`R-ACC-02`).

**`R-ACC-04` — role power must not become a reveal back door.** No permission grants reading another
partner's unrevealed entry. `OWNER` holding `permissions: 'all'` must still be refused, because the
gate is the reveal state, not a permission. Proven by an integration test that signs in as OWNER and
reads PARTNER's unsubmitted-pair entry (`R-DAY-05`).

---

## 2. Ownership and visibility

| Entity | Owned by | "Own" means | Who sees all | Rule ID |
|---|---|---|---|---|
| `DailyTask` | the couple | nothing — the list is shared by design | both partners | `R-TASK-01` |
| `DayEntry` | the authoring partner (`partnerId`) | `partnerId = actor.id` | nobody unconditionally; the partner's entry becomes visible only when both submitted | `R-DAY-05` |

**`R-TASK-01` — the shared list is genuinely shared.** `DailyTask` has no owner scope: both partners
see and act on every task. `forWhom` is information shown on the row, never a permission. A partner
may complete a task marked for the other — that is the point of a shared list.

**`R-DAY-05` — the reveal rule (the product's one inviolable rule).** For a given `entryDate`, partner
A may read partner B's `executionRating`, `respectRating` and `note` **only if A has also submitted an
entry for that date**. Until then the service omits those three fields from the view entirely —
absent, not `null` — and the API response does not contain them. A may always see *whether* B has
submitted (a boolean), because waiting for someone is not private. Enforced in
`src/domain/day-entries/day-entries.ts`, never in the UI.

*Why "A has submitted" and not "both have submitted": they are the same condition. The pair is
revealed when both exist, and A reading it implies A's own exists.*

---

## 3. Entities and invariants

### `DailyTask`

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | cuid | ✓ | — |
| `title` | text | ✓ | 1–200 chars after trim |
| `forWhom` | enum `ME`/`PARTNER`/`BOTH` | ✓ | stored as written by the creator; `ME` means the creator |
| `taskDate` | `@db.Date` | ✓ | the day the task belongs to; may be today or any other day |
| `dueTime` | `DateTime` (instant) | — | wall-clock hint; entered as date+time, converted with `localToInstant` |
| `note` | text | — | 0–500 chars |
| `completedAt` | `DateTime` | — | set together with `completedById`, never alone |
| `completedById` | ref `User` | — | set together with `completedAt`, never alone |
| `createdById` | ref `User` | ✓ | from the session, never from the request body |
| `archivedAt` / `archivedById` / `archiveReason` | — | — | archive, not delete |
| `version` | `Int` | ✓ | both partners edit the same list → optimistic concurrency |

Invariants (database CHECK constraints in the migration SQL):
- `R-TASK-10` — `completedAt` and `completedById` are either both set or both null.
- `R-TASK-11` — `archivedAt` and `archivedById` are either both set or both null.
- `R-TASK-12` — `length(trim(title)) BETWEEN 1 AND 200`.
- `R-TASK-13` — `version >= 1`.

Removal: **archive**. A task that stopped being relevant ("להזמין מקום לשבת" — they went out instead)
is a business decision, not a mistake, and the reason is worth keeping. Nothing is hard-deleted.

### `DayEntry`

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | cuid | ✓ | — |
| `entryDate` | `@db.Date` | ✓ | the day being reviewed |
| `partnerId` | ref `User` | ✓ | from the session, never from the request body |
| `executionRating` | `Int` | ✓ | 1–5 |
| `respectRating` | `Int` | ✓ | 1–5 |
| `note` | text | — | 0–1000 chars |
| `submittedAt` | `DateTime` | ✓ | server clock at submission |

Invariants:
- `R-DAY-10` — unique `(entryDate, partnerId)`: one entry per partner per day, guaranteed by the
  database, not by a service check.
- `R-DAY-11` — `executionRating BETWEEN 1 AND 5`.
- `R-DAY-12` — `respectRating BETWEEN 1 AND 5`.
- `R-DAY-13` — `length(note) <= 1000` when present.

Removal: **never**. A `DayEntry` is a diary page. No archive columns, no soft delete.

No `version` column: only its author may write it (`R-DAY-03`), so two people cannot edit one row.

---

## 4. Lifecycles

### `DailyTask` states

| State | Label | Meaning | Terminal |
|---|---|---|---|
| `OPEN` | פתוחה | on the list, not done | no |
| `COMPLETED` | נסגרה | someone ticked it | no |
| `ARCHIVED` | בארכיון | stopped being relevant | no |

| Transition | From → To | Permission | Reason required | Side effects | Rule ID |
|---|---|---|---|---|---|
| complete | OPEN → COMPLETED | `tasks.complete` | no | sets `completedAt`, `completedById` | `R-TASK-03` |
| reopen | COMPLETED → OPEN | `tasks.complete` | no | clears both | `R-TASK-04` |
| archive | OPEN/COMPLETED → ARCHIVED | `tasks.archive` | **yes** | leaves the working list and the completion figures | `R-TASK-05` |
| restore | ARCHIVED → OPEN | `tasks.archive` | **yes** | returns to the working list, completion cleared | `R-TASK-06` |

**`R-TASK-04` — reopening is deliberately free.** No reason, no permission beyond `tasks.complete`,
either partner. A mis-tap at 23:40 must be undoable without a dialog.

### `DayEntry`

No state machine. Absent or submitted.

- **`R-DAY-01`** — a partner may submit for `entryDate` only when the review time for that date has
  passed (see `R-SET-01`). Refused with `errors.businessRule` naming the time it opens.
- **`R-DAY-02`** — a partner may submit at most once per date (`R-DAY-10`); a second attempt is a
  `conflict`, not a silent overwrite.
- **`R-DAY-03`** — a submitted entry may be **edited only by its author, and only while the other
  partner has not yet submitted**. Once revealed, it is frozen: the service refuses the write with a
  business-rule error. (Decision point D-3.)
- **`R-DAY-04`** — a partner may always read their own entry in full.

---

## 5. Calculations

All in `src/domain/summaries/calculations.ts` as pure functions. Worked examples below are copied
verbatim into `tests/unit/summaries/calculations.test.ts`.

### `R-CALC-01` — day average for a partner
- Inputs: one `DayEntry` (`executionRating`, `respectRating`).
- Formula: `(executionRating + respectRating) / 2`.
- Rounding: one decimal, half away from zero, once at the end.

| Case | Inputs | Expected |
|---|---|---|
| plain | 4, 3 | 3.5 |
| equal | 5, 5 | 5.0 |
| rounds up at the half | 4, 3 → 3.5 stays 3.5; 5,4 → 4.5 stays 4.5 | 3.5 / 4.5 |
| lowest | 1, 1 | 1.0 |

### `R-CALC-02` — range average for one partner
- Inputs: every `DayEntry` that partner submitted with `entryDate` in the range.
- Formula: mean of **all** their ratings (each entry contributes two numbers).
- Rounding: one decimal, half away from zero, once at the end.
- Edge case: no entries in range → `null` (not 0 — "no data" is not "bad").

| Case | Inputs | Expected |
|---|---|---|
| three days | (4,3), (5,5), (2,2) | 21/6 = 3.5 |
| one day | (3,4) | 3.5 |
| none | — | null |

### `R-CALC-03` — range average for the couple
- Inputs: the dates in range on which **both** partners submitted; all four ratings per such date.
- Formula: mean of every rating on those dates only. Dates where one partner submitted are excluded.
- Rounding: as above. No both-closed dates → `null`.

| Case | Inputs | Expected |
|---|---|---|
| one day both, one day single | Mon A(4,3) B(3,3); Tue A(5,5) only | mean of 4,3,3,3 = 3.25 → 3.3 |
| nothing mutual | Mon A only | null |

*Note the contrast with `R-CALC-02`: on the same data, A's own average is mean of 4,3,5,5 = 4.25 → 4.3.
Two different questions, two different denominators; the summary labels say which.*

### `R-CALC-04` — closed-together streak
- Inputs: the range's dates in ascending order, each with "did A submit" and "did B submit"; plus
  which date is today.
- Formula: walk backwards from the last date. If the last date is today and not both-closed, skip it
  once (a live day is not yet a gap). Then count consecutive both-closed dates; stop at the first date
  that is not both-closed.

| Case | Inputs | Expected |
|---|---|---|
| five both, today open | d1–d5 both, d6=today nobody | 5 |
| gap before today | d1–d5 both, d6 A only, d7=today nobody | 0 |
| unbroken including today | d1–d6 both, d7=today both | 7 |
| nothing | all open | 0 |

### `R-CALC-05` — task completion for a range
- Inputs: tasks whose `taskDate` is in the range and that are **not archived**; each with
  `completedById` or null.
- Formula: `completed / total` as a percentage, rounded to the nearest whole number. The per-partner
  split is each partner's completions over the completed total; the **second** percentage is computed
  as `100 − first` so the two shown values always sum to 100.
- Edge cases: no tasks in range → `null` percentage and no split. No completions → 0% and no split.

| Case | Inputs | Expected |
|---|---|---|
| nine of twelve, 6/3 | 12 tasks, 9 done (A 6, B 3) | 75%, split A 67% / B 33% |
| thirds | 3 done (A 1, B 2) of 3 | 100%, split A 33% / B 67% |
| none in range | 0 tasks | null |
| none done | 5 tasks, 0 done | 0%, no split |

### `R-CALC-06` — the best day of the month (monthly summary only)
- Inputs: both-closed dates in the month with their four ratings.
- Formula: the date with the highest mean of the four; ties resolve to the **later** date (the more
  recent good day is the one worth remembering).
- No both-closed dates → `null`.

---

## 6. Money

**Not applicable.** This product handles no money. No agorot fields, no rates, no VAT, no adjustments.
`core/money` is unused by this domain, deliberately.

---

## 7. Dates and periods

| Date field | Meaning | Decides |
|---|---|---|
| `DailyTask.taskDate` | the day the task belongs to | which day's list it appears on; which range counts it |
| `DailyTask.dueTime` | wall-clock hint within that day | display order and the "עד 19:00" hint only |
| `DailyTask.completedAt` | instant of the tick | nothing in the figures except *that* it is set; `completedById` decides the split |
| `DayEntry.entryDate` | the day being reviewed | which range the entry counts in; the reveal pairing |
| `DayEntry.submittedAt` | instant of submission | ordering and "who submitted first"; never a business date |

- **Period definition:** a summary **week** is Sunday–Saturday (the Hebrew week); a summary **month**
  is a calendar month. They are ranges, not periods in the foundation's `assertPeriodOpen` sense.
- **Nothing is ever closed or locked.** There is no period close in this domain, no snapshots, no
  `calculationVersion`. Reason: no figure becomes authoritative and no money depends on one, so a
  lock would add a concept the couple would have to understand for no benefit. (Decision point D-4.)
- **"Today"** is `todayIn('Asia/Jerusalem')`.
- **The review time** is a `LocalTime` setting evaluated against a business date with `localToInstant`,
  so both DST changes are handled by core. A review time inside the spring-forward gap is rejected at
  the setting level with a field error (`R-SET-02`).

---

## 8. Exceptions and follow-up

| ID | Condition | Detected how | Who handles | Resolves when |
|---|---|---|---|---|
| `R-DAY-20` | a day in the last 14 days, older than yesterday, that neither partner closed | scoped count of dates with no `DayEntry` | either partner | either partner closes it, or it ages past 14 days |

Deliberately **not** built: manual follow-ups (there is nobody to assign to inside a couple) and any
attention rule that would read as nagging. `src/domain/follow-ups.ts` declares **no** targets.

Hard refusals (submitting early, submitting twice, editing after the reveal) are invariants in §3/§4,
not attention items.

---

## 9. Reports and documents

| Report | Audience | Permission | Source | Printable | Rule IDs |
|---|---|---|---|---|---|
| Weekly summary | both partners | `summaries.read` | live | no | `R-SUM-01`, `R-CALC-01..05` |
| Monthly summary | both partners | `summaries.read` | live | no | `R-SUM-01`, `R-CALC-01..06` |

**`R-SUM-02` — a summary never leaks an unrevealed rating.** Summaries aggregate; an unrevealed day
contributes to its own author's average and to nothing the other partner can see per-day. The weekly
view lists per-day figures for the **other** partner only for revealed dates; unrevealed dates show as
"waiting", never as a number. Proven by an integration test.

---

## 10. Audit

Recorded (in the same transaction as the write), registered in `src/domain/audit.ts`:

| Action | Reason required | Payload |
|---|---|---|
| `task.created` | no | title, forWhom, taskDate |
| `task.updated` | no | changed field names and values (domestic detail, not sensitive) |
| `task.completed` / `task.reopened` | no | task id and title |
| `task.archived` / `task.restored` | **yes** | task id, title, reason |
| `day_entry.submitted` | no | `entryDate` **only** |
| `day_entry.amended` | no | `entryDate` **only**, plus `ratingsChanged: true` / `noteChanged: true` |

**`R-DAY-30` — ratings and notes never enter the audit log.** The OWNER can read the audit log, so
writing a rating into it would defeat the reveal rule permanently. The payload records *that* the day
was closed and *that* values changed — never the values. Proven by an integration test that asserts
the audit payload for a submission contains no rating and no note text.

**Reads are not audited** (brief §22): logging who looked at their partner's note would be
surveillance inside a relationship, and the log is OWNER-readable.

---

## 11. Settings

| Key | Meaning | Default | Range | Affects history? |
|---|---|---|---|---|
| `review.daily_time` | the wall-clock time from which the day may be closed | `21:30` | `LocalTime` "HH:MM", any valid time; rejected if it falls in the DST spring-forward gap | **No** — an entry records its own `submittedAt`; changing the time never invalidates a past entry |
| `partners.display_order` | which partner is shown first in side-by-side views | the OWNER first | one of the two partner ids | no |

**`R-SET-01`** — the review time is read with `getSetting` on every submission (never cached), and the
"can the day be closed yet" flag on the view is computed from the same value the service enforces.
**`R-SET-02`** — only `settings.manage` (OWNER) may change it; the other partner sees the current value
read-only, because a shared ritual time that one person can silently move is a trust problem.

---

## 12. Decision points (open)

The implementation chose the safest generic behaviour for each. The product owner must confirm.

| ID | Question | Current behaviour | Owner | Due |
|---|---|---|---|---|
| D-1 | One couple per deployment, or many couples in one app? | **One couple per deployment**, per ADR 0009 — no `coupleId` on any row, the two partners are two `User` rows. Serving many couples means a multi-tenant rewrite of every scope plus an ADR superseding 0009. | product owner | before any second couple is onboarded |
| D-2 | A review submitted at 00:20 — which day does it close? | The day **that just ended** is offered as the default when the current local time is before 04:00, and the partner can still pick the calendar day. The date is always explicit in the request, never inferred silently. | product owner | before launch |
| D-3 | May a submitted entry be edited? | **Yes, but only before the reveal** (`R-DAY-03`). After the reveal it is frozen, so the diary cannot be rewritten once seen. | product owner | before launch |
| D-4 | Do summaries ever become authoritative (snapshot + lock)? | **No.** Always recomputed live; nothing locks. | product owner | when/if figures are used outside the app |
| D-5 | The nightly reminder | **Not built.** The foundation has no outbound notification capability (FOUNDATION §12) and adding one needs a provider choice, an ADR and secrets. This is the product's biggest functional gap: a nightly ritual without a nudge depends on habit alone. | product owner | before launch |
| D-6 | Data export / erasure when a partner leaves | **Not built.** No export route, no erasure flow. Entries are never deleted (§28). | product owner | before real personal data accumulates |
| D-7 | What exactly does the respect rating rate? | **"How much respect I felt from my partner today."** Chosen as the least harmful reading of "independent mutual-respect rating": each partner reports their own experience rather than scoring the other's character. If the intent was "how well I treated my partner", it is a copy change in one strings file — the schema does not change. | product owner | before launch |
| D-8 | i18n | **Hebrew-first, i18n-ready.** All domain copy lives in one module (`src/domain/copy.ts`) keyed by concept, direction and language come from `businessLocale` in `src/brand/brand.ts`, and every layout uses logical properties. Adding English means adding a second dictionary and flipping `direction` — not a rewrite. Core's own Hebrew copy (`src/core/copy.ts`) would need the same treatment, which is a core change and therefore an ADR. | product owner | when a non-Hebrew user is real |

---

## 13. Design divergences from `DESIGN_REVIEW.md`

`DESIGN_REVIEW.md` and `docs/DESIGN_PATTERN_LIBRARY.md` were written for **operational business
software** — a ledger, a clinic, a law office. This product is a consumer lifestyle app for two
people, and the brief's §18 direction contradicts some of those rules. Resolved deliberately here
rather than silently in the CSS; each divergence is reported in the final report.

**Kept in full** (these are not style, they are quality):
- Semantic tokens only; no raw colour classes. One accent with a job.
- AA contrast, ≥44px targets, axe green, keyboard reachable, `prefers-reduced-motion` honoured.
- RTL logical properties; LTR isolation for numbers and Latin runs; time steps follow reading direction.
- One primary action per screen; empty states that say what/why/what-to-do; no fake KPIs.
- Errors say what happened and the next step; no codes; forms are `method="post"`.
- No blue/purple gradients, no glassmorphism, no "AI sparkle", no chart nobody asked for.
- Hierarchy from weight and position before size; no ad-hoc type sizes.

**Diverged, with reasons:**

| Rule | Divergence | Why |
|---|---|---|
| "No decorative badges, **streaks**, confetti or gamification" | A **closed-together streak** is shown in the summaries, and completing a task plays a short mark-and-spark. | The streak is the product's core emotional feedback about a shared ritual, not a points system: it has no reward, no leaderboard, no loss aversion, and it can never be spent. Removing it would remove the reason the summaries exist. The completion mark is one authored moment, ≤600ms, suppressed under reduced motion. |
| "Not every block is a floating card. Surfaces have edges (rules), shadows only on overlays." | Cards with soft warm shadows are used on the summary screens. | A ledger reads best as ruled rows because its job is comparison. This product's job is reflection, at 4–6 items per screen. Rules are still used inside each card and for the day list; the phone home screen is ruled rows, not a card grid. |
| "Quiet ordinary states, chips only for movement" | The reveal state ("ממתין לפרטנר" / revealed) is shown prominently. | It is not an ordinary status, it is the one thing the person came to find out. |
| "Frequent actions are instant; motion is for overlays and disclosure" | Task completion and the rating dial are animated, and they are the most frequent actions. | Those two interactions *are* the product (brief §18). They stay on transform/opacity only, never block input, and reduce to a short fade under `prefers-reduced-motion`. |
| Density: "0.5rem ledger … 1rem calm" | `--brand-row-padding-y` set to the calm end, and the type scale leans on the larger steps. | Brief §18: spacious, few items, used one-handed in the dark. |
| Radii | Softer across the board than the foundation default, still **differentiated by kind**. | A consumer-facing product is softer than a ledger; the "one radius everywhere" tell is still avoided. |
| Light-only palette | A **dark scheme** is added in `src/brand/theme.css` via `prefers-color-scheme`. | Brief §17: the primary usage is at night, in bed, in the dark. Contrast is re-checked for both schemes and recorded next to the tokens. |

**Not diverged, worth stating:** no Rive, no Lottie, no WebGL/3D in v1. The brief allows them "only
where they genuinely improve delight" and "very carefully"; each would add a dependency, an asset
pipeline and a payload for a product whose delight comes from motion on elements that are already
there. Depth is done with warm-tinted shadows and radial gradients. Recorded so the choice is visible.

---

## 14. Change log

| Date | Rule IDs | Change | Requested by |
|---|---|---|---|
| 2026-09-22 | all | First version, from the product owner's mandate | product owner |
