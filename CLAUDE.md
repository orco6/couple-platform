# Instructions for AI agents (Claude Code, Codex, Cursor, …)

Read before editing:
1. `FOUNDATION.md` — architecture, boundaries, injected seams, tests layout, what is not included.
2. `docs/adr/` — why things are the way they are.
3. New business: `NEW_BUSINESS_PROJECT_PROMPT.md`. Features: `DOMAIN_IMPLEMENTATION_CHECKLIST.md`.
4. Any screen: `docs/SCREEN_BUILDING_PLAYBOOK.md` (questions, build order, state matrix) and
   `docs/DESIGN_PATTERN_LIBRARY.md` (patterns, the quality bar, what was rejected and why).

Where things go:
- Platform: `src/core/`, core screens (`src/app/(app)/{account,admin,attention}`, `login`, `change-password`),
  `tests/*/core`, `e2e/core`, `scripts/lib`, `templates/`. Business: `src/domain/<area>/`, route groups
  `src/app/(app)/(<area>)`, `src/app/api/(<area>)`, `src/app/print/(<area>)`, `tests/*/<area>`, `e2e/<area>`.
- Domain → generic screens only through `src/domain/{contract,navigation,attention,follow-ups,dev-data}.ts`.

Hard rules:
- `src/core/` is stable platform code. Do not modify it to fit one business. If a generic gap is real:
  change it with tests (and an ADR for decisions), and call it out in your report.
- Core imports the domain only via `@/domain/contract` (lint-enforced). Core code and core tests never
  name a role — use `core/access/role-queries.ts`.
- Every data access: `requireActor`/page guard → service → `assertCan` + entity scope in the query.
  Never filter authorization in React. Out of scope → 404. Sensitive fields: omit from the view, keep out of audit.
- Request schemas are `.strict()` Zod built from `core/validation/fields`, exported as `*Schema`
  (a structural test checks every one). Optional: absent = unchanged, null = clear.
- Money: integer agorot, basis points, `core/money` (`prorate` for fractions). Business dates: `CalendarDate`
  + `@db.Date`. Times of day: `date` + `time` from the client, `localToInstant` on the server, `localDayRange` for days.
- Writes that matter: `recordAudit(tx, …)` in the same transaction.
- Schema change = migration (`npm run db:migrate:dev -- --name x`; it regenerates the client). Never `db push`,
  never reset/seed a non-local database, never weaken `core/db/safety.ts` or `prisma-command-guard.ts`.
- UI: semantic tokens only (no raw colours), core components (`DateInput`, `TimeInput`, `MoneyInput`,
  `ResponsiveTable` + `parseSort`), Hebrew copy, logical properties, `Ltr` for Latin/number runs.
  Forms: `method="post"`, `FormField name`, `onInput={clearOnInput}`. One primary button per view; quiet
  ordinary statuses; empty states say what/why/what to do. The UI is done only after
  `npm run qa:screenshots` has been looked at (desktop + iPhone) and the design critique in
  NEW_BUSINESS_PROJECT_PROMPT.md §9 is written.
- Never deploy, create production databases, change DNS or run production migrations without explicit approval.
- Before committing: `npm run typecheck`, `npm run lint`, `npm test` (and `npm run e2e` for UI flows). Report exact
  counts. Do not edit a core test to make new code pass.
- Tooling: the Write tool may turn `\uXXXX` escapes into literal invisible characters; `npm run lint` catches it
  and `node scripts/escape-invisible.mjs src scripts tests e2e` fixes it. Pages under `(app)` stream: a not-found
  page returns HTTP 200 with the not-found screen — assert page privacy by content, API privacy by status.
