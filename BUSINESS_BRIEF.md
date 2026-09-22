# Business brief — שנינו (couple-platform)

> Written from the product owner's mandate (2026-09-22). Where the mandate was silent the answer is
> **unknown** and becomes a documented decision point in `BUSINESS_RULES.md` — never an invented rule.

---

## 1. Business description

A very small, highly emotional, mobile-first platform for **one couple** — two partners who share a
daily list, close the day with two independent ratings, and look back at the week and the month
together.

- **Size:** 2 people. One shared list of a handful of tasks a day; two day-entries a day; ~60
  day-entries a month. This is the smallest data volume the foundation has ever carried.
- **What they use today:** WhatsApp messages, a note on the fridge, and nothing at all for the part
  that matters (how the day actually felt to each of them). What hurts is that the emotional
  bookkeeping is invisible: nobody can see a pattern, only the last argument.
- **The one outcome that makes this a success:** at the end of a week, both partners can see the same
  honest picture of how the week went — and the app was pleasant enough that they actually opened it
  every night.

**This is not office software.** It is a consumer lifestyle product. The logic is deliberately
trivial; the design, motion, interaction quality and polish are the functional requirements. See §18.

## 2. Users

| Person | Count | Device | Daily job in the system |
|---|---|---|---|
| Partner | 2 | phone (primary), desktop occasionally | Sees today's shared list, closes tasks during the day, and at the review time submits the day's two ratings and an optional note; then sees the reveal |
| Owner (also a partner) | 1 of the 2 | phone/desktop | Everything a partner does, plus inviting/managing the second partner and changing the shared settings |

Both are non-technical. Both use it in bed, one-handed, at ~23:40, on a phone, in the dark.

## 3. Roles

| Role key (latin) | Label (Hebrew) | Holders | Sees | Must never see |
|---|---|---|---|---|
| `OWNER` | בעלים | the partner who set the app up | Everything a partner sees, plus user management, settings and the audit log | The other partner's ratings or note for a day **before both have submitted** — ownership does not beat the reveal rule |
| `PARTNER` | פרטנר | the second partner | The shared list, own day entries, the other partner's entries **only after both submitted**, the summaries | The other partner's ratings or note for a day before both have submitted; user management; the audit log |

There is no third role. There is no "manager" — a couple is not a hierarchy. `OWNER` exists only
because the foundation requires one role that covers every other role and holds `users.manage`
(core depends on it), and because somebody has to be able to invite the second partner and reset a
password.

## 4. Permissions

| Capability | OWNER | PARTNER |
|---|---|---|
| See the shared task list | ✓ | ✓ |
| Create / edit / archive a shared task | ✓ | ✓ |
| Complete or reopen any task on the shared list | ✓ | ✓ |
| Submit own day entry (ratings + note) | ✓ | ✓ |
| Read own day entry | ✓ | ✓ |
| Read the partner's day entry | only after both submitted | only after both submitted |
| See weekly / monthly summaries | ✓ | ✓ |
| Change the daily review time and other shared settings | ✓ | — |
| Manage users, reset passwords | ✓ | — |
| Read the audit log | ✓ | — |

- **Who may manage users and reset passwords:** OWNER only.
- **Who may close a period / approve a report:** nobody. There is no period close and no approval in
  this product — see §10 and decision point D-4.

The tasks are deliberately **shared, not owned**: either partner may complete a task the other
created. A task carries who it is *for* (me / my partner / both of us) as information, not as a
permission. Enforcing "only you may tick your task" would make the product worse — the whole point is
that one partner can pick up the other's errand.

## 5. Entities

| Entity | Fields | Owner | Removal | Unique by |
|---|---|---|---|---|
| `DailyTask` | title (text, req), forWhom (choice: ME/PARTNER/BOTH, req), taskDate (business date, req), dueTime (time of day, opt), note (text, opt), completedAt (instant, opt), completedById (ref, opt), createdById (ref, req), version | the couple (both partners) | archive (`archivedAt/ById/Reason`) — a task that stopped being relevant is not a mistake | — |
| `DayEntry` | entryDate (business date, req), partnerId (ref, req), executionRating (choice 1–5, req), respectRating (choice 1–5, req), note (text, opt), submittedAt (instant, req) | the partner who wrote it | never removed (it is a diary) | (entryDate, partnerId) |

- `DayEntry` has **no** `version`: only its own author can write it, so two people cannot edit it at
  once. `DailyTask` **does** carry `version` — both partners edit the same list.
- Uniqueness on `(entryDate, partnerId)` is what makes "one entry per partner per day" a database
  guarantee rather than a service convention.
- No money anywhere in this product. No `Int` agorot fields, no VAT, no rates. §8 is therefore empty.

## 6. Workflows

1. **During the day.** Either partner opens the app, sees today's shared list, and completes tasks as
   they get done. Completing is one tap on the whole row. A completed task can be reopened by either
   partner (a mis-tap must be undoable).
2. **Adding a task.** Either partner adds a task for today or a later date, says who it is for, and
   optionally a time ("עד 19:00") and a note.
3. **At the review time.** After the configured daily review time (a shared setting, e.g. 21:30), the
   day can be closed. Each partner independently submits: an **execution rating** (how well they held
   up their side of the day, 1–5), a **respect rating** (how much respect they felt from the other
   partner that day, 1–5), and an optional **note**.
4. **The reveal.** Until both partners have submitted for that date, neither can see the other's
   ratings or note — only *whether* the other has submitted. When the second partner submits, both
   entries become visible to both, together.
5. **Looking back.** The weekly and monthly summaries show both partners' averages over the range,
   how the two ratings moved, how many days both closed, and how the shared list went.
6. **When something goes wrong.** Submitting twice for the same day is refused (the unique
   constraint + a clear message). Submitting before the review time is refused with the time it opens.
   A partner who wants to change a submitted entry may do so **only while the other has not yet
   submitted** — once the day is revealed, the entry is frozen (decision point D-3).

## 7. Calculations

Deliberately simple, and each is a pure function with a worked example test.

1. **Day average for a partner** = mean of that partner's two ratings for the day, to one decimal.
   *Example: execution 4, respect 3 → 3.5.*
2. **Range average per partner** = mean of every rating that partner submitted in the range, to one
   decimal. *Example: a partner submitted (4,3), (5,5), (2,2) over three days → mean of
   4,3,5,5,2,2 = 21/6 = 3.5.*
3. **Range average for the couple** = mean of every rating **both** partners submitted in the range.
   Days where only one partner submitted are excluded from the couple average (an unrevealed day is
   not a data point about the couple) but are included in that partner's own average.
   *Example: Mon both (4,3)/(3,3); Tue only partner A (5,5). Couple average = mean of 4,3,3,3 = 3.25.
   A's own average = mean of 4,3,5,5 = 4.25.*
4. **Closed-together streak** = consecutive days, counting back from the most recent day in the range,
   on which **both** partners submitted. The current day does not break a live streak if it has not
   been closed yet; any earlier gap does.
   *Example: days 1–5 both closed, day 6 only A, day 7 (today) nobody → streak = 0 measured from
   day 6, because day 6 is an earlier gap once day 7 is skipped. If day 6 were both-closed and day 7
   open, the streak = 6.*
5. **Task completion for a range** = completed tasks ÷ tasks whose `taskDate` falls in the range,
   as a percentage rounded to the nearest whole number; and the split of completions between the two
   partners by `completedById`. *Example: 9 of 12 tasks completed, 6 by A and 3 by B → 75%, split
   67% / 33% (rounded so the two shown percentages sum to 100).*
6. **Rounding:** all displayed averages are one decimal, half away from zero. Percentages are whole
   numbers; the split's two percentages are computed so they sum to 100 exactly.

Ratings are a **choice of 1–5**, not a measurement. They are stored as `Int` with a CHECK constraint,
and they are not money — no agorot, no basis points.

## 8. Money rules

**None.** This product handles no money. Nothing is priced, invoiced, paid or refunded.

## 9. Lifecycle states

| Entity | From → To | Who | Reason? | Effect |
|---|---|---|---|---|
| `DailyTask` | OPEN → COMPLETED | either partner | no | sets `completedAt` + `completedById`; counts toward the range's completion figures |
| `DailyTask` | COMPLETED → OPEN | either partner | no | clears `completedAt` + `completedById` (mis-tap recovery) |
| `DailyTask` | OPEN/COMPLETED → ARCHIVED | either partner | yes | leaves the working list; excluded from completion figures |
| `DailyTask` | ARCHIVED → OPEN | either partner | yes | returns to the working list |
| `DayEntry` | (none) → SUBMITTED | its author | no | the day is closed for that partner; triggers the reveal if the other has already submitted |

`DayEntry` has no state machine: it is either absent or submitted. Its *visibility* changes, which is
a derived fact about the pair of entries, not a state on the row.

## 10. Dates

- **Business dates:** `DailyTask.taskDate` (the day the task belongs to) and `DayEntry.entryDate`
  (the day being reviewed). Both `@db.Date`.
- **Instants:** `DailyTask.completedAt` (when it was ticked), `DayEntry.submittedAt` (when it was
  submitted), and core's `createdAt`. Displayed in Asia/Jerusalem.
- **Time of day:** `DailyTask.dueTime` is a wall-clock hint entered as `date` + `time` and stored as an
  instant via `localToInstant`. The **daily review time** is a shared setting holding a `LocalTime`
  ("HH:MM"); "has the review time passed today?" is evaluated by converting it against today's
  business date with `localToInstant`, so it is correct across both DST changes.
- **What "today" means:** `todayIn('Asia/Jerusalem')`. A couple in Israel closing the day at 23:40 is
  still closing *that* day; a review at 00:20 closes the day that just ended — see decision point D-2.
- **Periods:** a week (Sunday–Saturday, the Hebrew week) and a calendar month, used only as summary
  ranges. **Nothing is ever locked or closed.** There is no `assertPeriodOpen` in this domain, because
  no figure here becomes authoritative and no money depends on it.

## 11. Documents and files

None. No uploads, no photos, no avatars (partners are identified by a name and an initial). The
foundation has no file storage and this product does not need it.

## 12. Dashboard needs

Both roles need the same thing first, in this order:

1. **Today's shared list** — what is still open, and who each item is for.
2. Whether the day can be closed yet, and if it has been closed by the other partner (not *what* they
   said — just that they are waiting).
3. Nothing else. No figures, no charts, no "how are we doing" on the home screen. The summaries are a
   separate destination people go to on purpose.

## 13. Reports

| Report | Audience | Filters | Content | Printable | Authoritative |
|---|---|---|---|---|---|
| Weekly summary | both partners | the week (stepper) | couple average, each partner's average, the two ratings' movement across the week, days both closed, streak, task completion and split, the week's notes once revealed | no | no |
| Monthly summary | both partners | the month (stepper) | the same, over a calendar month, plus the best day of the month | no | no |

Neither becomes a snapshot: nothing approves or closes, and both are cheap to recompute. No print
routes in this product (§15).

## 14. Exceptions / follow-up

The foundation's attention and follow-up machinery does not fit this product, and forcing it would
make a couple's evening feel like a ticketing queue. One derived attention rule is worth having and is
written in the product's own calm words:

- **A day that was never closed by either partner**, older than yesterday and within the last 14 days
  — shown as something you *may* fill in, never as a failure, and it resolves itself the moment either
  partner closes it. No manual follow-ups, no assignment (there is nobody to assign to).

## 15. Print

Nothing is printed. A couple does not print their week. No print routes.

## 16. Notifications

**None in v1** — and this is the product's biggest known gap, because a nightly reminder is what makes
a nightly ritual happen. The foundation has no outbound notification capability (FOUNDATION §12), so
adding one is a real decision with a provider choice: decision point D-5.

## 17. Mobile usage

**Both roles, phone-first, essentially always.** Conditions: in bed, in the dark, one hand, often
while tired. Consequences that are requirements, not preferences:

- Every frequent action must be reachable with one thumb.
- Completing a task must not require hitting a small target.
- The dark scheme is the one most used, not an afterthought.
- Desktop must work and look right, but it is the secondary case.

## 18. Branding and visual direction

- **Product name:** שנינו (latin: `couple-platform`). One line in their words: none — the name is
  enough, and a tagline on a two-person app is filler.
- **Existing brand:** none — propose.
- **Legal name / business ID / address / phone for documents:** not applicable; nothing is printed and
  there is no legal entity. These stay empty and the print layout omits empty fields.

**Visual direction**

- **It should feel:** intimate and premium. Warm, elegant, quiet, playful only in the refined sense —
  never cute, never gamified in a points-and-badges way.
- **Density:** spacious. Few items per screen, generous space, large touch targets. The opposite of a
  ledger.
- **Mainly used on:** phone, by both partners (§17).
- **What they already look at all day that the app could echo:** a handwritten note left for each
  other — warm paper, ink, one small mark. The concept is **a note passed between two people at the
  end of the day**, not a dashboard about a relationship.
- **Products whose look they like:** not named. The stated bar is "premium native lifestyle app,
  internationally competitive".
- **It must definitely NOT look like:** an admin dashboard, a SaaS starter, a CRUD app, office
  software, or a recoloured foundation demo. Explicitly **not** the visual personality of Koma or the
  real-estate law office — it borrows their engineering, not their face.

This direction conflicts with parts of `DESIGN_REVIEW.md`, which was written for operational business
software. The conflicts are resolved deliberately in `BUSINESS_RULES.md` → "Design divergences",
not silently.

## 19. Terminology

| Concept | Their word | Not |
|---|---|---|
| the couple / the two of them | שנינו | "הזוג", "החשבון", "הארגון" |
| the other person | הפרטנר, or their first name | "המשתמש האחר", "שותף" |
| shared task | משימה | "מטלה", "פריט", "רשומה" |
| the shared list | הרשימה שלנו | "מטלות", "ניהול משימות" |
| closing the day / the daily review | סגירת היום | "דירוג יומי", "טופס", "דוח" |
| execution rating | ביצוע | "פרודוקטיביות", "ציון" |
| respect rating | כיבוד | "שביעות רצון", "יחס" |
| the optional note | פתק | "הערה", "הערות חופשיות" |
| the reveal | גילוי | "חשיפת נתונים" |
| consecutive days both closed | רצף | "streak", "הישג" |
| weekly / monthly summary | סיכום שבועי / חודשי | "דוח", "אנליטיקס" |

Never in the UI: "רשומה", "ישות", "פריט", "משתמש" (when a partner is meant), "ניהול", and none of the
banned filler in the playbook's copy rules.

## 20. Integrations

None. No accounting, no calendar, no payment provider, no imports.

## 21. Special rules

- The reveal rule is the product's one inviolable rule. It is a **privacy control between two people
  who live together**, and it must be enforced by the server — in the service, absent from the view —
  not by the UI. A partner who opens dev-tools, guesses an API route, or reads the audit log must not
  be able to see the other's rating before submitting their own.
- Ratings and notes are the most sensitive data in the product. They must never appear in an audit
  payload, a log line, an error message or a URL.
- The OWNER's user-management powers must not become a back door to the other partner's entries.

## 22. Visibility and sensitive data

| Data | Sensitive because | Who may see | Who may change | On paper / in exports? |
|---|---|---|---|---|
| `DayEntry.executionRating` | it is a self-judgement | its author always; the other partner only after both submitted | its author, only before the reveal | no |
| `DayEntry.respectRating` | it is a judgement of the relationship, and seeing it early would change the answer | its author always; the other partner only after both submitted | its author, only before the reveal | no |
| `DayEntry.note` | free text written in a private moment between two people | its author always; the other partner only after both submitted | its author, only before the reveal | no |
| `DailyTask.note` | ordinary domestic detail | both partners | both partners | no |

- **Must reading a record be logged?** No. Auditing who read their partner's note would be
  surveillance inside a relationship, and the audit log is readable by the OWNER — logging reads would
  itself become the leak. Writes are audited; reads are not.
- **ID numbers, bank details, health data, children's data:** none stored. Names and ratings only.

## 23. Identifiers and external references

None. Nothing in this product has a number people say out loud.

## 24. Recurring work and billing

Nothing recurs as data. The *ritual* recurs daily, which is a notification concern (§16), not a
recurring-record concern. Nothing is billed.

## 25. Approvals

Nothing needs approval. The reveal is not an approval — it is a symmetric condition, and neither
partner can grant it to the other.

## 26. Existing data, imports and exports

Nothing to import. The first two users are the two partners; the OWNER is created by the bootstrap
script and invites the second. On the first day, adding a task, closing a day, and the reveal must
work — nothing else.

## 27. Business calendar

- No working days, no holidays, no closed days: a couple has a day every day.
- The week runs **Sunday to Saturday** (the Hebrew week) for the weekly summary.
- The only time that matters is the daily review time, which is a setting.

## 28. Retention and regulation

- No legal or professional obligation applies. No bookkeeping records, no medical records.
- `DayEntry` rows are a diary and are **never deleted or edited after the reveal** — that is a product
  rule, not a legal one, and it is what makes the diary trustworthy.
- If a partner leaves, a person must be able to get their data out or have it removed; the mechanism
  is not built in v1 — decision point D-6.

## 29. Open questions

Recorded as decision points D-1 … D-8 in `BUSINESS_RULES.md`, with the safest generic behaviour chosen
for each so the build can proceed:

- D-1 one couple per deployment vs many couples (multi-tenancy)
- D-2 which day a review after midnight belongs to
- D-3 whether a submitted entry can be edited before the reveal
- D-4 whether summaries ever become authoritative
- D-5 the nightly reminder (no notification capability in the foundation)
- D-6 data export / erasure for a partner who leaves
- D-7 the exact subject of the respect rating
- D-8 i18n: Hebrew-first now, English later
