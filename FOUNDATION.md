# Foundation architecture

This document is the map for people and AI agents. Read it before changing anything.

## 1. The one rule

**Core is stable. Domain is replaceable. Brand is identity.**

| Layer | Path | Changes when | Who may change it |
|---|---|---|---|
| Core platform | `src/core/`, `prisma/schema/core.prisma` (except the marked block), `src/proxy.ts`, `scripts/lib/`, core screens (`src/app/(app)/{account,admin,attention}`, `src/app/login`, …), `tests/{support,unit/core,integration/core}`, `e2e/core`, `templates/`, `scripts/new-business.ts` | a platform capability is genuinely missing or wrong | deliberately, with an ADR in `docs/adr/` and tests |
| Domain | `src/domain/`, `prisma/schema/domain.prisma`, one route group per area (`src/app/(app)/(<area>)`, `src/app/api/(<area>)`, `src/app/print/(<area>)`), the home page (`src/app/(app)/page.tsx`, or inside the area's route group — this business keeps it in `(couple)/(today)` so it can have its own loading state), `tests/*/<area>`, `e2e/<area>` | every project | freely, following DOMAIN_IMPLEMENTATION_CHECKLIST.md |
| Brand | `src/brand/`, `src/app/icon.svg`, font import in `src/app/layout.tsx` | every project | freely |

A new business project should be able to finish **without editing `src/core/`**. If you find
yourself needing to, stop and ask whether the need is really generic. If it is, improve core
properly (tests + ADR) so the next project benefits. If it is not, it belongs in the domain.

## 2. Boundaries (enforced)

- `src/core/**` may import from the domain **only** through `src/domain/contract.ts` — ESLint rule
  `no-restricted-imports` fails the build otherwise.
- The contract exports exactly: `access` (roles/permissions), `auditVocabulary`, `settingDefinitions`.
- Everything else the domain gives the generic screens is **injected by the app layer**, never imported
  by core: `src/domain/navigation.ts` (menu), `attention.ts` (derived attention rules), `follow-ups.ts`
  (which records can carry a follow-up, with scoped reachability), `dev-data.ts` (fixture seeder used by
  `scripts/lib/fixtures.ts`). Each exists in `templates/blank-domain` with an empty, working default —
  a new business fills them in; nothing in core changes.
- Core code and core tests never name a role. They ask the access model: `rolesWith(permission)`,
  `rolesWithout`, `topRoles()`, `leastPrivilegedRole()` (`core/access/role-queries.ts`). This is why the
  same core suite passes for the sample, a blank domain and a clinic.
- Domain code imports core freely.
- `src/app/**` is glue: pages and route handlers call services; they contain no business rules and no
  arithmetic on money.
- Client components never import `db`, guards or services (`server-only` makes that a build error).

## 3. Request lifecycle

```
Browser ──▶ src/proxy.ts
            • API POST/PUT/PATCH/DELETE: same-origin check (CSRF defence in depth) → 403 if cross-origin
            • Pages: per-request CSP nonce, pathname header for post-login redirect
        ──▶ Page (server component)                      ──▶ Route handler (src/app/api/**/route.ts)
            requireActorPage() / requirePermissionPage()     apiRoute(name, async ({ request, params }) => {
            → service(db, actor, …)                            const actor = await requireActor();
            → render                                            const input = await readBody(request, schema.strict());
                                                                return service(db, actor, input);
                                                              })  // AppError → status + Hebrew message; else generic 500
        ──▶ Service (core or domain)
            • re-checks permission (assertCan)
            • scopes every query structurally (scopeWhere / entityScope(actor))
            • validates business rules, lifecycle transitions, period locks
            • writes + recordAudit(tx, …) in ONE transaction
```

Authentication is **never** decided in the proxy. Every page and every handler checks for itself.

**404 on pages vs APIs.** An out-of-scope record is a 404 everywhere, but a *page* under the `(app)`
loading boundary streams, so its not-found screen arrives with HTTP status 200 (Next.js behaviour).
The content is the not-found screen and nothing about the record is sent. API routes return a real 404
status — assert privacy on pages by content, on APIs by status.

## 4. Core modules

| Module | What it gives you | Key files |
|---|---|---|
| `env` | typed, validated environment; fails early | `env/env.ts` |
| `errors` | 8 categories (validation, authentication, authorization, not_found, conflict, business_rule, rate_limited, unexpected) | `errors/errors.ts` |
| `http` | route wrapper, strict body parsing, idempotency keys, same-origin check, safe redirects, browser client | `http/*` |
| `auth` | scrypt hashing, password input normalization + policy, DB sessions (idle + absolute expiry), DB-backed throttling, sign-in, own password change, guards | `auth/*` |
| `access` | permission model with escalation rule, structural scoping helpers, role queries | `access/define-access.ts`, `access/can.ts`, `access/role-queries.ts` |
| `users` | admin user management: temp passwords, reset, disable, role change, last-administrator guard | `users/users.ts` |
| `audit` | append-only log (DB trigger), vocabulary, redaction, diffs, readable summaries | `audit/*` |
| `db` | client, transactions, history helpers (archive / soft delete), destructive-operation guard, Prisma CLI guard (`prisma.config.ts` refuses `db push`, and `migrate reset/dev` / `db execute` on non-local databases) | `db/*` |
| `validation` | strict request fields: text, phone, email, calendarDate, localTime (exactly HH:MM), money (optionally signed), ids, version, reason | `validation/fields.ts` |
| `lifecycle` | explicit state machines with per-transition permission and reason | `lifecycle/lifecycle.ts` |
| `money` | integer minor units, basis-point rates, BigInt rounding, allocation, `prorate` (fractional quantities, partial months, minutes), signed input for refunds, VAT net/gross, formatting | `money/*` |
| `dates` | `CalendarDate` business dates, strict DD.MM.YYYY, business-timezone "today", periods, DST-safe local time ↔ instant (`localToInstant`, `instantToLocal`), `localDayRange` for "everything on this business day" (23/25-hour days) | `dates/*` |
| `periods` | close / reopen a period with advisory locks; authoritative snapshots | `periods/periods.ts` |
| `follow-ups` | soft exceptions: derived attention rules + manual follow-ups on domain-declared targets | `follow-ups/*` |
| `dev-data` | the `DomainSeeder` contract: fixture users per role handed to the domain's seeder | `dev-data/types.ts` |
| `settings` | typed business settings with defaults, audited, no caching | `settings/*` |
| `ui` | tokens, motion, components, app shell, print layout, URL sort state | `ui/*` |
| `copy.ts` | every user-facing core sentence (Hebrew) | `copy.ts` |

## 5. How authentication works

- **Passwords**: scrypt (N=2^15, r=8, p=1) with parameters stored in the hash; old parameters are
  upgraded on next sign-in. Input is normalized identically in browser and server (bidi marks,
  zero-width characters, edge whitespace, NFC) — the Koma "pasted password is wrong" bug.
- **Policy**: ≥10 characters, ≤256, not common, not containing the username. No composition rules.
- **Sessions**: 256-bit random token in an httpOnly, SameSite=Lax cookie (`__Host-session` over
  HTTPS). Only SHA-256 of the token is stored. 7-day sliding idle expiry, 30-day absolute cap.
  Every request re-checks the user is ACTIVE with a known role.
- **Revocation**: disabling a user, resetting a password or changing a role deletes all that user's
  sessions. Changing your own password ends all *other* sessions.
- **Temporary passwords**: generated server-side, shown once to the administrator, never stored
  readable or logged; `mustChangePassword` is enforced on **pages and API** alike.
- **Throttling**: DB-backed; 5 failures per username / 50 per client address in 15 minutes → 15-minute
  lock. Uniform responses and timing whether the user exists, the password is wrong, or the account
  is disabled.

## 6. How authorization works

1. **Permissions, not roles, are checked.** `can(actor, 'customers.read_all')`. Roles are bundles of
   permissions declared in `src/domain/access.ts`.
2. **Escalation rule.** An actor can create/edit/disable/reset only users whose role permissions are a
   subset of the actor's own, and assign only such roles.
3. **Privacy is structural.** Every query for data a user may not fully see ANDs a scope:
   ```ts
   export function customerScope(actor: Actor): Prisma.CustomerWhereInput {
     return scopeWhere(actor, { all: 'customers.read_all', own: { ownerId: actor.id } });
   }
   db.customer.findFirst({ where: { AND: [customerScope(actor), { id }, activeOnly] } })
   ```
   Never fetch everything and hide rows in React.
4. **Out of scope = 404.** A record the actor cannot see is indistinguishable from one that does not
   exist.
5. **Field-level permissions** are checked in the service for fields that carry authority (owner,
   assignee, price). Request schemas are `.strict()`, so unknown fields are rejected (mass assignment).
6. **Field-level reads.** A field some roles must not read (clinical notes, salary, cost price) is left
   *out of the view object* by the service — absent, not `null` — and its content is never copied into
   the audit log (record a "changed" marker instead). Hiding it in React is not a control.
7. **UI hiding is UX.** Navigation is filtered and views carry `permissions` flags, but every write is
   re-authorized in the service.

## 7. Data conventions

- Money: `Int` agorot; rates `Int` basis points; the rate used is stored on the record.
- Dates: business dates are `@db.Date` ↔ `CalendarDate` ("YYYY-MM-DD"); instants are `DateTime`,
  displayed in `Asia/Jerusalem`. `createdAt` is never a business date.
- Wall-clock times (appointments, shifts): the client sends `date` + `time` (`fields.calendarDate`,
  `fields.localTime`); the **server** converts with `localToInstant` (null for a time skipped by the DST
  change → field error). Store the instant; list a day with `localDayRange`.
- Signed money (refunds, credits) only where the schema says `fields.money({ allowNegative: true })`;
  add a CHECK that forbids zero when zero is meaningless.
- History: **archive** (`archivedAt/ById/Reason`, reversible business decision) vs **soft delete**
  (`deletedAt/ById`, "should not have existed"). Hard delete only for sessions, throttle rows and
  expired idempotency keys.
- Lifecycle: per-entity state machine, explicit transitions, reasons for overrides.
- Concurrency: records edited by several people carry `version`; stale writes get 409 `STALE_WRITE`.
- Snapshots: when a calculated result becomes authoritative (period close, approval), store it with
  `calculationVersion` and the inputs that explain it; read it back instead of recalculating. For
  figures you need to query relationally, add a typed snapshot table in the domain.
- Audit: services call `recordAudit(tx, …)` inside the transaction. The table rejects UPDATE/DELETE.

## 8. Design system

Tokens are two layers: raw brand values (`src/brand/theme.css`) → semantic Tailwind tokens
(`src/core/ui/styles/foundation.css`). Tailwind's default palette is removed, so components can only
use semantic colours (`bg-surface`, `text-ink-muted`, `border-rule`, `bg-accent`). Changing a business's
identity is a brand-folder change. See DESIGN_REVIEW.md.

Components (`src/core/ui/components`): Button, IconButton, ButtonLink, FormField, Input, Textarea,
Select, Checkbox, RadioGroup, Switch, PasswordField, DateInput, TimeInput (24-hour HH:MM), MoneyInput
(optionally signed), FilterBar/SearchFilter/SelectFilter/SortFilter, Dialog, BottomSheet, ConfirmDialog,
Toast, Disclosure, LinkTabs, CursorPagination, StatusBadge, ResponsiveTable (sortable header links with
`aria-sort`, sticky header, row list on phones), DescriptionList, PageHeader, Section, Panel, Toolbar,
FormSection, FormError, EmptyState, ErrorState, LoadingState, Ltr/MoneyText/DateText/DateTimeText/
PhoneLink/EmailLink; shell: AppShell (sidebar + mobile bottom bar + "more" sheet); print: PrintLayout
(identity from `src/brand/brand.ts`; empty contact fields are left out).

Inputs report exactly what is on screen: unreadable text gives the parent `null`/`''`, never a stale
value, and marks the control `aria-invalid`.

Buttons press in 40ms and release over 200ms; loading keeps the width and swaps to a spinner only after
150ms. `StatusBadge` renders ordinary states (neutral, muted) as quiet text and chips only for states
that moved. `EmptyState` requires a description (what, why, what to do). `ResponsiveTable` cells return
`null` for missing values (dash on desktop, omitted on phones); row titles wrap to two lines.
Overlays: `onExited` to open the next overlay after the previous one closes. Shell: `RouteSettle`
(180ms on pathname change), `SessionNotice` (a save refused because the session ended keeps the form
and offers sign-in in a new tab), the phone tab bar steps aside while typing, scroll padding under the
sticky bars. Forms: `method="post"` (lint rule), `FormField name` + `useSubmit().clearOnInput` (server
errors clear on edit), `core/ui/form-values.ts` (credential forms submit what is in the fields).
`Notice` explains persistent record states (archived, locked period) next to the record; `ClearFilters`
(server-safe) clears only filter parameters and is the action of filtered-empty states; `SearchFilter`
follows the URL and shows a delayed spinner while the list refreshes. Brand tokens beyond colour: display
face and heading weights/sizes, row density, chrome surface, radii by kind (`src/brand/theme.css`; proof in
`docs/BRAND_FLEXIBILITY.md`). Raw colour classes (`text-[#…]`) fail lint outside print layouts.
Design patterns and when to use each: `docs/DESIGN_PATTERN_LIBRARY.md`; per-screen questions:
`docs/SCREEN_BUILDING_PLAYBOOK.md`.

Hooks: `useSubmit` (pending, field errors, idempotency, double-submit guard; focuses the first invalid
control, or shows the messages as the form error when the form has no control for that field).
Sorting: `core/ui/sorting.ts` (`parseSort` allow-lists keys from the URL; the domain maps the key to
`orderBy` and always appends `{ id: 'asc' }`).

## 9. The sample domain and the blank domain

`src/domain/sample/` is a small service business (customers, tasks, notes, monthly revenue). It exists
to prove the core: scoping with two ownership paths, field-level permissions, lifecycle with reason,
money + VAT frozen per task, business dates, period close + snapshots, derived attention rules, manual
follow-ups, archive vs soft delete, optimistic concurrency, server-side sorting. Everything it owns lives
in named places (`SAMPLE_PATHS` in `scripts/new-business.ts`): `src/domain/sample`, the `(sample)` route
groups, `tests/{unit,integration}/sample`, `e2e/sample`, the `*_sample_domain` migration.

`npm run foundation:new-business` removes all of it and installs `templates/blank-domain` (roles
OWNER/ADMIN/STAFF, empty audit vocabulary, settings, attention rules, follow-up targets and seeder, a
generic home page). CI's `blank-foundation` job performs that conversion on every push and runs the
core suite on the result (typecheck, lint, unit, integration, migration drift, E2E) — so "the sample
can be removed cleanly" is tested, not promised.

**Stress test.** A dental clinic (patients, appointments in Israel time, treatments with clinical notes
hidden from reception, signed payments, print summary) was built on a converted copy to find gaps. It
needed no clinic-specific core change; the generic gaps it exposed were fixed in core with tests
(`localDayRange`, `TimeInput`, strict `localTime`, print identity placeholders, Prisma client
regeneration after migrations, two input bugs, table sorting).

## 10. How to…

- **Add a role**: `src/domain/access.ts` → `roles`. No migration. Add authorization tests.
- **Add a permission**: `domainPermissions`, grant to roles, `assertCan` in the service, page guard if it
  gates a screen, navigation entry `permission`.
- **Add an entity**: DOMAIN_IMPLEMENTATION_CHECKLIST.md → "New entity".
- **Add a report**: pure calculation function + tests; service with permission + scope; page; print
  page with PrintLayout; snapshot on close if it becomes authoritative.
- **Add a setting**: `src/domain/settings.ts` with schema + default. Never cache it.
- **Add a migration**: edit `prisma/schema/*.prisma`, `npm run db:migrate:dev -- --name <change>`,
  review the SQL, keep it additive (ADR 0004), commit schema + migration together. CI fails on drift.
- **Add a sortable list**: allowed keys + default next to the service; `parseSort(searchParams, keys,
  default)` in the page; map key → `orderBy` in the service (explicit `switch`; `nulls: 'last'` only on
  nullable columns) + `{ id: 'asc' }`; `ResponsiveTable sort={…}` + `SortFilter` for phones. Example:
  `src/app/(app)/(sample)/customers/page.tsx`.
- **Add appointments / shifts**: `date` + `time` fields, `localToInstant` on the server, `DateInput` +
  `TimeInput` in the form, `localDayRange` for day views, an integration test across a DST change.
- **Add fractional quantities** (1.5 hours, 2.25 litres): store integer thousandths; line total =
  `prorate(unitPriceAgorot, quantityMilli, 1000)`.
- **Create a new business app**: NEW_BUSINESS_PROJECT_PROMPT.md.

## 11. Tests layout

| Path | What | Changes per business |
|---|---|---|
| `tests/unit/core`, `tests/integration/core`, `e2e/core` | platform behaviour, **role-agnostic** (roles from `tests/support/roles.ts` / `e2e/helpers.ts`, derived from the access model) | no |
| `tests/unit/core/request-schemas-strict.test.ts` | structural: every `*Schema` exported from `src/domain` rejects unknown fields | no — it scans the new domain automatically |
| `tests/{unit,integration}/<area>`, `e2e/<area>` | the business's rules, authorization matrix, workflows | yes |
| `e2e/core/accessibility.spec.ts` | axe-core WCAG 2.1 A/AA on sign-in, core pages and `/design-system` (verified to catch injected violations) | no — add `e2e/<area>/accessibility.spec.ts` for business screens |
| `e2e/core/form-safety.spec.ts` | no field values in URLs before hydration, autofilled credentials, typed input kept when the session ends | no |
| `e2e/qa/sweep.qa.ts` (`npm run qa:screenshots`) | screenshot sweep at 1440px Chromium and iPhone 13 WebKit, derived from the rendered navigation; fails on console errors and sideways scrolling; not in CI | add `e2e/qa/<area>.qa.ts` for states navigation cannot reach |
| `tests/support` | test database guard, per-test truncation, core factories (`makeUser`, `caught`) | no |

Fixture users exist for every declared role: `<role>` and `<role>2` (lower-case, `_` → `-`), plus
`pending` (must change password) and `disabled`. Password `yesod-dev-password`, local databases only.

Critical controls are mutation-checked (entity scope, permission check, `.strict()`, audit trigger,
date rollover, closed period, idempotency fingerprint, HTTPS session cookie, same-origin check): each
mutation fails at least one test. Suites pass in shuffled order and on repeated runs.

## 12. Not included (decide per business)

File storage (documents, photos, X-rays), outbound notifications (email/SMS/WhatsApp), two-factor
authentication, self-service password reset, recurring billing or scheduled jobs beyond the daily
housekeeping cron, full-text search, multi-tenancy (ADR 0009), languages other than Hebrew. Each is a
decision point in the brief; adding one to core needs an ADR, tests, and a reason that applies to more
than one business.
