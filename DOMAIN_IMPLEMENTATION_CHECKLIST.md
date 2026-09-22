# Domain implementation checklist

Use for every new entity, role, workflow or report. Each item exists because skipping it has caused a
real bug in a real business app.

## Starting a real project

- [ ] `npm run foundation:new-business -- --name "<שם העסק>" --slug <latin-slug> --db-port <free port>`
      (NEW_BUSINESS_PROJECT_PROMPT.md → "How to use"). It removes the sample (`SAMPLE_PATHS`, the
      `*_sample_domain` migration, the sample back-relations in `core.prisma`), installs
      `templates/blank-domain`, renames local infrastructure and sets the brand name.
- [ ] `git diff --stat` reviewed; `npm run db:up && npm run db:reset:local && npm run check` green;
      `npm run e2e` green. Commit this before any business code — it is the baseline core tests must
      keep passing against.
- [ ] Keep `*_core_platform` and `*_core_*` migrations: they hold the core tables, the append-only audit
      trigger and core CHECK constraints.

## New entity

**Schema**
- [ ] Money `Int` (agorot), rates `Int` (bps), rate stored on the record when it matters historically.
- [ ] Business dates `@db.Date`; never reuse `createdAt` as a business date.
- [ ] Times of day (appointments, shifts) stored as a `DateTime` instant, entered as `date` + `time` and
      converted on the server with `localToInstant`; durations as integer minutes with a CHECK range.
- [ ] Fractional quantities as integer thousandths (`quantityMilli`), never `Float`/`Decimal` arithmetic in JS.
- [ ] Ownership column(s) that the scope will filter on, with an index.
- [ ] Removal: `archivedAt/archivedById(/archiveReason)` or `deletedAt/deletedById`. No cascade deletes of history.
- [ ] `version Int @default(1)` if two people can edit it at once.
- [ ] Relations to User declared + back-relations in the marked block of `core.prisma`; `onDelete: Restrict`.
- [ ] CHECK constraints for invariants (non-negative money, consistent status/date pairs) in the migration SQL.
- [ ] Unknown historical values are nullable, not defaulted to a guess.
- [ ] `npm run db:migrate:dev -- --name add_<entity>`; read the SQL; additive if production exists.

**Access**
- [ ] Permissions added (`<area>.read_all`, `.create`, `.edit_all`, `.archive`, field-level ones like `.set_price`).
- [ ] `<entity>Scope(actor)` returning a Prisma where; used in EVERY list, get, update, delete, count, and
      in attention rules and follow-up target checks.
- [ ] Out-of-scope lookups throw `errors.notFound`.
- [ ] Sensitive fields (clinical notes, salaries, cost prices, ID numbers) have their own read permission
      if not every role that sees the record may see them; the service omits them from the view.
- [ ] Scope through a relation when ownership is indirect (e.g. a dentist reaches a patient through their
      own appointments) — and test the person who is NOT related.

**Service**
- [ ] Zod schemas built from `fields.*`, all `.strict()` (the structural test fails otherwise); optional
      fields: absent = unchanged, null = clear. Exported schema names end in `Schema`.
- [ ] The acting person (`createdById`, `recordedById`, treating employee) comes from the session, never
      from the body.
- [ ] Explicit field list on every write (never spread input into `data`).
- [ ] `assertCan` for the action and for each authority-carrying field (owner, assignee, price, status).
- [ ] Lifecycle via `defineLifecycle`; transitions only through a transition service; reasons where overriding.
- [ ] `assertPeriodOpen(tx, scope, period)` for every period the write affects (old and new).
- [ ] `updateMany({ where: { id, version } })` + `errors.staleWrite()` for versioned records.
- [ ] `recordAudit(tx, …)` in the same transaction; action registered in `src/domain/audit.ts`
      (with `requiresReason` for overrides); field labels/formats registered for readable summaries.
- [ ] Sensitive content is not copied into audit payloads (administrators read the log): record
      `notesChanged: true`, not the notes. Reading a private record can itself be audited
      (`<entity>.viewed`) when the business needs to know who looked.
- [ ] Views are explicit objects (no Prisma rows to the client); include `permissions` flags for UX.
- [ ] Money arithmetic only in pure functions in the domain; results formatted with `MoneyText`/`formatMoney`.

**HTTP + UI**
- [ ] Route handlers: `apiRoute` → `requireActor` → `readBody(schema)` → service. `withIdempotency` on POST creates.
- [ ] Files in one route group per area: `src/app/(app)/(<area>)`, `src/app/api/(<area>)`, `src/app/print/(<area>)`.
- [ ] Pages: `requireActorPage`/`requirePermissionPage`; `notFound()` on `not_found` errors.
- [ ] Lists: server-side filters in the URL, cursor pagination, `ResponsiveTable` with mobile column placement;
      sortable columns via `parseSort` (allow-listed keys) + explicit `orderBy` map + `{ id: 'asc' }` +
      `SortFilter` on phones.
- [ ] Forms: `useSubmit`, `FormField`, `DateInput`/`TimeInput`/`MoneyInput` (`allowNegative` only for refunds
      and adjustments), server field errors shown per field, `dismissible={!pending}` on dialogs.
- [ ] Latin/number runs (phones, emails, ids, amounts) wrapped in `Ltr`/`MoneyText`/`DateText`.
- [ ] Empty, loading and error states written in the business's words.

**Tests**
- [ ] Unit: calculations with worked examples; schema edge cases.
- [ ] Integration: other owner → 404 for get/update/transition/delete; forged authority fields → 403;
      role without permission → 403; sensitive fields absent for roles without the read permission and
      absent from audit; audit written without secrets; period lock; stale version → 409; for times of
      day: a date across the DST change and a late-evening time listed on the right local day.
- [ ] Mutation-check the entity's scope once: replace `own` with `{}`, confirm a test fails, restore.
- [ ] E2E: happy path, one validation error, one permission check by URL (not-found screen) and by API (status).

## New role
- [ ] Added to `roles` with label/description; permissions reviewed against the matrix in BUSINESS_RULES.md.
- [ ] `roleCovers` gives the intended management hierarchy (unit test).
- [ ] Fixture users `<role>`/`<role>2` appear automatically; E2E sign-in and authorization tests include the role.

## New report
- [ ] Pure calculation function + unit tests with the brief's numbers.
- [ ] Service: permission, scope, period state; snapshot on close if authoritative (`calculationVersion`).
- [ ] Page with chronology left→right, totals as a double-ruled row; print page via `PrintLayout`
      containing only what belongs on paper.

## New setting
- [ ] Only if the business changes it without a developer. Schema + default in `src/domain/settings.ts`.
- [ ] Read with `getSetting` each time (no caching). Historical records store the value they used.

## New attention rule / follow-up kind
- [ ] Rule added to `src/domain/attention.ts`; scoped query; calm wording; resolves itself when data is fixed.
- [ ] Follow-up targets: add the entity to `src/domain/follow-ups.ts` with a scoped `canReach`.
