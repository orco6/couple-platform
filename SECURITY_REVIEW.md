# Security review — שנינו (couple-platform)

The record SECURITY_CHECKLIST.md asks every project to keep: the 🔁 lines answered for
*this* domain's entities, and the red-team script run with its results.

Reviewed against commit `8d5123c`. Suite at the time: 194 unit, 79 integration, 88 E2E.

---

## What this product is guarding

Three things, in order of how much damage their exposure would do:

1. **The daily entries.** A 1–5 answer about whether someone felt respected, plus a free-text
   note. Both partners answer independently and neither sees the other's until both have
   submitted (R-DAY-05). This is the product's one promise, and it is the only thing here that
   could genuinely hurt someone if it leaked — including to an administrator.
2. **The shared list.** A household's errands, with notes. Mundane, and still nobody else's.
3. **Task ratings.** How one partner rated a chore the other finished. Ordinary feedback; the
   only sensitive part is who gave it, which is structural (the non-owner, always).

The order matters because it decided where the strongest control went. The reveal gate is
enforced by *not selecting* the partner's columns, not by filtering them after the fact.

---

## The 🔁 lines, answered for this domain

| Checklist line | This domain |
| --- | --- |
| Every list/get/update/delete/count uses the entity scope | `taskScope(client, actor)` returns `{ ownerId: { in: [the couple] } }` and is `await`ed into all six task queries. `DayEntry` reads are keyed on `partnerId: actor.id` (mine) and the partner's id from the link (theirs, reveal-gated). `tests/integration/couple/scope.test.ts` — 7 tests; 4 fail if the scope is weakened to `{}` (mutation-checked). |
| Sensitive fields a role may not read are omitted by the service | On an unrevealed day the partner's `respectRating` and `note` are **never in the SELECT**; `DayView.theirs` is *absent*, not null. `tests/integration/couple/reveal.test.ts`; asserted at the HTTP level in `e2e/couple/review.spec.ts` ("the other is served a page that does not contain the answer"). Audit payloads record `entryDate` and change *markers* (`ratingsChanged`, `noteChanged`), never values — R-DAY-30. |
| Sortable lists accept only allow-listed sort keys | No list in this product takes a sort parameter. Order is fixed in the service (open before closed, then the time hint, then stable by id). Nothing to allow-list; if a sort is ever added it must go through core's `parseSort`. |
| Views carry capability flags computed from the same rules as the service | `TaskView.permissions.{complete,reopen,edit,archive,restore,rate}` come from the lifecycle's `available()` and, for `rate`, from the same three conditions `rateTask` enforces. `DayView.permissions.{submit,amend}` likewise. `tests/integration/couple/task-ratings.test.ts` asserts the flag matches what the service accepts, from both partners' sides. |
| Out of scope → 404 | `getTask`, `updateTask`, `transitionTask` all `findFirst` through the scope and throw `errors.notFound()`. Never 403, which would confirm the row exists. `e2e/couple/privacy.spec.ts`. |
| Authority-carrying fields checked individually | `ownerId` is the one field here that carries authority — it decides who may rate — so it is re-checked against the link on create *and* on update (`assertIsPartner`), separately from the row's own scope check. The acting person is always `actor.id`: `createdById`, `completedById`, `ratedById`, `partnerId`, `linkedById` are never read from a body. |
| Page guard on every page under `(app)`; `requireActor` first line of every handler | 11 pages, 11 guards (`requireActorPage`, or `requirePermissionPage` for `/archive` and the three `/admin` screens). 8 domain route handlers, each opening with `requireActor()`. |
| New views: select explicit fields | `TASK_SELECT`, `LINK_SELECT` and the day-entry selects are explicit constants; every service returns a hand-built view object. No Prisma row with relations reaches a client. |
| Any new free-text field rendered as HTML needs a sanitizer | None. Titles, notes and reasons are rendered as text by React. `react/no-danger` is a lint error. |
| New financial entities | None. This product has no money and no periods, so the period-lock and CHECK-constraint lines do not apply. |
| Production DB role lacks UPDATE/DELETE on `AuditEvent` | Inherited from the foundation; the SQL is in PRODUCTION_READINESS.md §3 and has to be applied when this is deployed. **Not yet done — there is no deployment.** |
| Backups encrypted before real data exists | **Not yet done — there is no deployment.** Blocking for launch, not for the build. |

---

## Red-team script — results

Run against the E2E database on a production build. "Where" names the test that keeps it true.

| # | Attempt | Result | Where |
| --- | --- | --- | --- |
| 1 | A third active account (`partner2`, PARTNER role, not in the link) reads and writes the couple's tasks by URL and by API | Empty list by URL; 404 on `PATCH` and on `transition`; 422 `NOT_IN_PARTNERSHIP` on create; 422 on rate | `e2e/couple/privacy.spec.ts`, `tests/integration/couple/scope.test.ts` |
| 2 | `createdById`, `completedById`, `completedAt`, `archivedAt`, `archiveReason`, `rating`, `partnerId`, `revealed`, `ratedById` added to bodies that do not accept them | 400 on every one. The schemas are `.strict()`, so these are refusals rather than silently ignored keys — and a structural test scans `src/domain` for any `*Schema` that is not strict at every level | `e2e/couple/privacy.spec.ts` ×2, `tests/unit/core/request-schemas-strict.test.ts` |
| 3 | Every `/api/admin/**` route as PARTNER | 403 | `e2e/core/security.spec.ts` (the core spec computes its "unprivileged" user from the access model, which resolves to PARTNER here) |
| 4 | Sign in, disable the account from another session, reuse the cookie | 401 | core auth tests |
| 5 | Replay a day-entry submission with the same `Idempotency-Key` | One entry; the replay returns the stored response | `e2e/couple/privacy.spec.ts` |
| 6 | Cross-origin POST with a valid session, on this domain's three write routes | 403 on all three | `e2e/couple/privacy.spec.ts` |
| 7 | `?next=//evil.com` on login | Lands on `/` | core |
| 8 | Malformed JSON, oversized body, ratings of `0`, `6`, `2.5`, `-1` | Clean 400s, no internals | core + `e2e/couple/privacy.spec.ts` |
| 9 | Closed-period edit | N/A — no periods | — |
| 10 | `UPDATE`/`TRUNCATE "AuditEvent"` | Trigger rejects the update; TRUNCATE needs the production role grants (see above) | core `platform.test.ts` |
| 11 | Same `Idempotency-Key`, different body | 422 `IDEMPOTENCY_KEY_REUSED` | `e2e/couple/privacy.spec.ts` |
| 12 | `__Host-session` plus a planted `session` cookie over HTTPS | Acts as the `__Host-` one | core |
| 13 | Read the partner's unrevealed answer through the page, the served HTML and the API | Absent from all three. `?reveal=1` is not a switch; there is nothing to switch | `e2e/couple/review.spec.ts`, `e2e/couple/privacy.spec.ts` |
| 14 | Assign a follow-up on a private record | N/A — this product defines **no** follow-up targets, deliberately (`src/domain/follow-ups.ts`): inside a couple there is nobody to assign one to, and follow-up notes live in the audit log |
| 15 | `?sort=…` on a list | N/A — no list takes a sort |
| + | The owner rating their own completed task | 422 `TASK_IS_MINE`, whatever the client sends | `e2e/couple/privacy.spec.ts`, `tests/integration/couple/task-ratings.test.ts` |
| + | Amending a day after the reveal | 422 `DAY_ALREADY_REVEALED` on the API, and the form is not on the screen | `e2e/couple/review.spec.ts` |

### Fixed during this review

- **The couple was not the scope.** `taskScope` returned `{}`, on the recorded reasoning that
  ADR 0009 (one deployment per business) made the deployment the isolation boundary. It does
  not: ADR 0009 is about where data lives, not who may read it, and `access.defaultRole` is
  `PARTNER` — so any account the owner created could read the household's list and edit it.
  Now scoped to the two people in the link. Commit `28a83bf`.
- **The attention rule read every `DayEntry` row** with no partner filter. It selects only
  dates, so no rating or note could leak, but it would have told a non-member which evenings
  the couple closed. Commit `8d5123c`.
- **Two navigation links had no pages.** Not a vulnerability; found by the same walk, fixed in
  the same commit, and now covered by a spec that visits every destination in the navigation.

---

## Accepted limitations

- **The audit log names tasks.** `task.created` and the transition events record the task's
  title so an event can be identified. Anyone with `audit.read` (OWNER) can therefore read
  task titles from the log. Ratings and day-entry values are *not* in the log at all, which is
  the line that matters. In this product the OWNER is one of the two partners, so nothing
  crosses the couple; a deployment whose owner is not a partner would want `audit.read`
  removed from that role.
- **The OWNER can reset the other partner's password** and so sign in as them (the foundation's
  equal-roles trade-off, ⚠️ in the checklist). Inside a couple this is a real asymmetry and it
  cannot be closed by permissions — it is inherent to "somebody has to be able to recover a
  forgotten password and there is no support desk". It is recorded, not hidden: R-ACC-04 says
  no *permission* grants reading an unrevealed entry, and that remains true — impersonation is
  a different attack, and the one an administrator always has.
- **Re-linking the partnership** replaces the row and leaves existing day entries with their
  authors (D-6). Old entries then belong to someone outside the link: they stay readable to
  their own author and to nobody else, and the tasks they owned drop out of scope. That is the
  intended behaviour, not an oversight.
- **No rate limiting outside sign-in.** Inherited. The write routes here are cheap and
  per-couple; a per-route limit is worth adding if this is ever deployed publicly.
