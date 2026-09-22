# New business project — the prompt

## How to use (a person does this, ~10 minutes)

```bash
git clone git@github.com:orco6/business-platform-foundation.git givon-dental
cd givon-dental
rm -rf .git
npm install
git init && git add -A && git commit -m "Foundation"
npm run foundation:new-business -- --name "מרפאת שיניים גבעון" --slug givon-dental --db-port 5435
git diff --stat                     # review: infrastructure renamed, sample removed, blank domain installed
cp .env.example .env
npm run db:up && npm run db:reset:local
npm run check                       # the blank foundation must be green before any business code
git add -A && git commit -m "Blank foundation for Givon Dental"
```

The script gives the project its own container, volume, database names and port (two projects never
share data), sets the product and legal name, removes the sample domain and installs
`templates/blank-domain`. It refuses a dirty working tree and refuses to run twice. `--dry-run` shows
what it would change; `--keep-sample` keeps the sample for learning.

Then fill in `BUSINESS_BRIEF.md` (created by the script from the template), create the private GitHub
repository, and start Claude Code in the project:

> **Read NEW_BUSINESS_PROJECT_PROMPT.md and follow it for BUSINESS_BRIEF.md.**

Everything below the line is the prompt.

---

You are adapting a production-grade business-software foundation into a bespoke application for the
business described in `BUSINESS_BRIEF.md`. The result must be trustworthy with real money, real
personal data and real employees.

## Ground rules

1. **Read first.** `AGENTS.md`, `FOUNDATION.md`, `DOMAIN_IMPLEMENTATION_CHECKLIST.md`,
   `SECURITY_CHECKLIST.md`, `DESIGN_REVIEW.md`, `docs/DESIGN_PATTERN_LIBRARY.md`,
   `docs/SCREEN_BUILDING_PLAYBOOK.md`, `docs/adr/`, then `BUSINESS_BRIEF.md`.
   The sample domain has been removed from this project; to see a worked example of a pattern, read it
   in the foundation repository (`src/domain/sample/`, `src/app/(app)/(sample)/`, `tests/integration/sample/`).
2. **Check the starting point.** `git log` should show the blank-foundation commit, and `npm run check`
   must pass before you write business code. If it does not, stop and report — do not "fix" core to get
   green.
3. **Do not rewrite core.** `src/core/`, `src/proxy.ts`, `prisma/schema/core.prisma` (outside the marked
   back-relations block), `scripts/lib/`, `tests/support/`, `tests/*/core/`, `e2e/core/`, CI and the core
   screens (`account`, `admin`, `attention`, `login`, `change-password`) are stable infrastructure. Use
   them freely. Change them only when a capability is genuinely generic and missing — then add tests
   and an ADR, and list the change in your final report. "Slightly more convenient" is not a reason.
4. **Never weaken a control to make something work**: no disabling guards, no `db push`, no removing
   `.strict()`, no fetching all rows to filter in React, no role-name checks instead of permissions, no
   floats for money, no `new Date(string)` for business dates, no building an instant from a date and a
   time in the browser, no editing a core test to match new behaviour.
5. **Do not invent business rules.** If the brief is silent or ambiguous, choose the safest generic
   behaviour, record it in `BUSINESS_RULES.md` under "Decision points", and continue. Things the
   foundation does not include (FOUNDATION.md §12: file storage, notifications, 2FA, …) are decision
   points too — do not quietly build a half version.
6. **Hebrew-first RTL, the business's own terminology** (brief §19) everywhere a person reads.
7. Work in stages; commit after each with a clear message. Run `npm run typecheck`, `npm run lint`,
   `npm test` before every commit (and `npm run e2e` when UI changed). Report exact counts. Do not
   declare anything done because it compiles.

## Stages

### 1. Understand and plan
- Write `BUSINESS_RULES.md` (created from the template): roles, permission matrix, entities, visibility
  and sensitive fields, lifecycles, calculations with the brief's worked examples, periods, exceptions,
  decision points.
- Map each brief section to foundation capabilities (FOUNDATION.md §4) and list what is genuinely new.

### 2. Visual direction and identity
Before any screen exists:
- **Define the visual direction** from brief §18 (feel, density, devices, what they look at all day,
  what it must NOT look like) and §19 (terminology). Write it at the top of `src/brand/theme.css` in
  a few sentences: the concept, the one recurring object of this business and how it is presented,
  density, the accent's job. If the brief is silent, choose the safest direction for the users and
  record it as a decision point — do not default to the foundation's look.
- **Tokens, not components:** `src/brand/theme.css` (colours with contrast notes, radii by kind,
  inverse surface), font in `src/app/layout.tsx`, `src/brand/brand.ts` (name, legal identity for
  print, tagline in their words or empty), `src/brand/Logo.tsx`, `src/app/icon.svg`.
- Read `docs/DESIGN_PATTERN_LIBRARY.md` §20 (what made the reference products stop looking
  generated) and apply it to this business. Do not copy another product's brand.

### 3. Access
- `src/domain/access.ts`: roles and permissions from the brief §3–4 and §22 (replace the blank OWNER/ADMIN/STAFF).
  Names `<area>.<capability>`, `_all` for beyond-own-records, separate permissions for sensitive field
  reads (e.g. `clinical_notes.read`). Verify the escalation rule gives the intended management
  hierarchy (unit test). Fixture users appear automatically for every role.

### 4. Data model and migrations
- Model the domain in `prisma/schema/domain.prisma` following ADR 0004: `Int` agorot, `@db.Date`
  business dates, `DateTime` instants for appointments, ownership columns, archive vs soft delete,
  `version` for concurrently edited records, indexes for every scoped list. Add back-relations to
  `User` in the marked block of `core.prisma`.
- `npm run db:migrate:dev -- --name <business>_domain`; then add CHECK constraints (hand-written SQL in
  that migration: non-negative money, sane durations, consistent status/date pairs) and re-run
  `npm run db:reset:local`. Read the SQL. The Prisma client is regenerated by the script.
- No production data yet → keep one domain migration. Production data exists → additive migrations only;
  unknown history stays nullable/"legacy", never fabricated.

### 5. Domain services (`src/domain/<area>/`)
For every entity: a scope function, strict Zod schemas from `core/validation/fields`, services that
`assertCan`, scope every query, enforce field-level permissions (writes AND reads), use
`defineLifecycle`, `assertPeriodOpen` for anything feeding a closable period, `recordAudit` in the same
transaction (no sensitive content in audit payloads), `errors.*` for every refusal. Calculations are
pure functions with worked-example tests.
Then fill in the injected seams: `src/domain/audit.ts`, `settings.ts`, `navigation.ts`, `attention.ts`,
`follow-ups.ts`, `dev-data.ts` (realistic fixtures created **through the services**).

### 6. Screens and API
- For **every** screen, answer the sixteen questions in `docs/SCREEN_BUILDING_PLAYBOOK.md` first and
  follow its build order and state matrix. Use the patterns in `docs/DESIGN_PATTERN_LIBRARY.md`; if you
  deviate from one, write down why.
- One route group per area: `src/app/(app)/(<area>)/`, `src/app/api/(<area>)/`, `src/app/print/(<area>)/`.
- Thin route handlers: `apiRoute` + `requireActor` + `readBody(strictSchema)` + service; `withIdempotency`
  on creates. Pages: `requireActorPage`/`requirePermissionPage`, call services, `notFound()` on
  `not_found`.
- Replace `src/app/(app)/page.tsx` with what each role must act on today (brief §12).
- Compose core components: `ResponsiveTable` (+ `parseSort`/`SortFilter` for sortable lists),
  `FormField`, `DateInput`, `TimeInput`, `MoneyInput`, `Dialog`, `PrintLayout`. Add a shared component to
  core only if it is genuinely reusable (then gallery entry + E2E).
- Mobile first for roles that use phones (brief §17). Print layouts for brief §15 documents, with only
  what belongs on paper.

### 7. Tests (in `tests/unit/<area>`, `tests/integration/<area>`, `e2e/<area>`)
- Unit: every calculation with the brief's worked examples, lifecycles, validation edge cases.
- Integration, per entity: other owner → 404 for get/update/transition/delete; forged authority fields
  → 403/400; role without permission → 403; sensitive fields absent from views for roles without the
  read permission and absent from audit; period locks; stale version → 409; DST for anything with a
  time of day; list sorting never widens scope.
- E2E: the main workflow per role, one validation error, privacy by direct URL (page shows not-found)
  and by API (404/403 status), mobile navigation, printing pages render, axe WCAG A/AA on every business
  screen (copy `e2e/core/accessibility.spec.ts`).
- Core suites and `request-schemas-strict.test.ts` must stay green untouched.
- Mutation-check the two or three controls that matter most for this business (break the scope or the
  permission, confirm a test fails, restore) and note the result in the report.

### 8. Security review — backend and UI
Walk `SECURITY_CHECKLIST.md` line by line against the new code, then its red-team script. Fix what you
find and add a test for each. Then review the UI against the server, screen by screen:
- Every action shown is one the server accepts for that person and that record state (closed period,
  archived, approved, someone else's record). If the server would refuse it, do not render it and say why
  with `Notice`; an integration test asserts the view's `permissions` match what the service accepts.
- Every action hidden from a role is still refused by its endpoint (API test by status).
- Archived and locked records never show edit, transition or delete actions that would fail.
- Sensitive fields are absent from the view, the print page and the API response for roles without access.
- After a role change or deactivation the person's sessions end (core does this) — verify their navigation
  and actions reflect the new role after signing in again.
- Two people editing the same record: the second save gets the stale-write message, not silent overwrite.

### 9. Design critique (the UI is not complete until this passes)
1. `npm run qa:screenshots` (desktop Chromium + iPhone WebKit; `npx playwright install webkit` once).
   Add `e2e/qa/<area>.qa.ts` captures for states navigation cannot reach (dialogs open, locked
   records, long content). Seed realistic data first: the longest names, missing contact details,
   multi-line notes, overdue items, refunds, 7-figure amounts.
2. Look at every image. For each major screen answer in writing: what is dominant, what is grouped,
   what is boxed and why, how many filled buttons, how many chips, does missing data read as missing,
   does the phone reach the first record without scrolling past controls.
3. **Compare against the quality bar** recorded in `docs/DESIGN_PATTERN_LIBRARY.md` (§0 extraction
   record, §20 visual intelligence) — the standard set by the reference products: rules over boxes,
   hierarchy from weight, quiet ordinary states, one primary action, empty states that instruct,
   motion that explains state. List each screen's gaps and fix them.
4. **Hallmark audit (required).** Hallmark must be available: check `~/.claude/skills/hallmark/PROVENANCE.txt`.
   If it is missing, install it with the pinned, reviewed procedure in DESIGN_REVIEW.md → "Installing
   Hallmark" (markdown only, original repository, pinned commit — never a fork, never an unpinned copy).
   Run `hallmark audit` on the app shell, every business screen and the screenshot folders. Treat the
   output as advice, not law: this is an operational business application, not a landing page — its
   hero, footer, macrostructure and eyebrow rules mostly do not apply; its state, token, contrast, copy,
   motion and anti-generic rules do. Fix real findings; record intentional divergences with a reason in
   the final report. Impeccable is **not** part of the process (docs/IMPECCABLE_ASSESSMENT.md); do not
   install it or any other skill without the owner's approval.
5. Walk `DESIGN_REVIEW.md` and the anti-generic list. If it looks like a generic AI SaaS dashboard,
   it is not finished.
6. axe accessibility specs green; `MANUAL_QA.md` items that need a real phone listed for the owner.
Only then declare the UI complete, and include the screenshot folder and the critique notes in the
final report.

### 10. Production readiness
Walk `PRODUCTION_READINESS.md` §0 and fill in the per-business column. Never deploy, create production
databases, change DNS or run a production migration without explicit approval from the project owner.

### 11. Definition of done — the business app is complete only when ALL of these are true
1. `BUSINESS_BRIEF.md` read in full; domain rules, calculations and open questions written in `BUSINESS_RULES.md`.
2. Roles and permissions defined in `src/domain/access.ts` from the brief, with authorization tests.
3. Visual direction written at the top of `src/brand/theme.css` **before** screens were built.
4. Every screen built from `docs/SCREEN_BUILDING_PLAYBOOK.md` (questions answered) using
   `docs/DESIGN_PATTERN_LIBRARY.md` patterns; deviations recorded with a reason.
5. Realistic seed data (longest names, long addresses and notes, missing fields, phones, emails, large
   amounts, refunds, dates, every status) used for every screenshot and review.
6. `npm run qa:screenshots` run; every major screen looked at on desktop and iPhone; written critique.
7. Hallmark audit run; findings fixed or divergences recorded.
8. Security review of backend and UI (stage 8) done; each finding has a test.
9. All checks green, with exact counts in the report: `npm run typecheck`, `npm run lint`,
   `npm run test:unit`, `npm run test:integration`, `npm run e2e` (desktop + mobile, including axe),
   `npm run build`, `npm audit`, migration drift (`npx prisma migrate diff --from-config-datasource
   --to-schema prisma/schema --exit-code` against the test database), and CI on GitHub.
10. No flaky test accepted: a test that failed once is investigated to a cause, not retried away.

### 12. Final report
What was built; roles and permissions; entities; calculations; decision points still open; every core
change (with ADR links and why it is generic); exact test results (counts per suite); mutation checks;
the design critique and Hallmark findings with divergences; screenshot folder; known limitations; next
steps. Do not call the application complete if any item of stage 11 is missing — list what is missing.
