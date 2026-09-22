# 0004 — Database conventions and migrations

Status: Accepted (2026-09-16)

## Context
Business data outlives code. Koma's history shows the recurring hazards: invented defaults for data
that predates a field, SQLite-vs-Postgres differences, a test reset pointed at the wrong database,
and history lost through cascades.

## Decision
**Engine**: PostgreSQL everywhere (local Docker, CI service, Neon). Prisma 7 with the `pg` driver adapter;
runtime uses the pooled URL, migrations use `DIRECT_URL`.

**Schema conventions**
- ids `cuid()`; `createdAt`/`updatedAt` bookkeeping only.
- Money `Int` agorot; rates `Int` bps; business dates `@db.Date`.
- Explicit relations with `onDelete: Restrict` for anything historical; `Cascade` only for sessions.
- Roles and audit actions are strings validated in code (no enum migrations for vocabulary changes);
  stable core states (UserStatus, PeriodLockStatus, FollowUpStatus) are enums.
- Archive vs soft delete (FOUNDATION.md §7); `version` for concurrent edits.
- Indexes for every scoped list's filter + order; no speculative indexes.
- Invariants Prisma cannot express are hand-written in the migration: CHECK constraints, the audit
  append-only trigger.
- JSON only for evidence payloads (audit before/after, snapshot data validated by schema on read), not
  for data the app queries.

**Migrations**
- Every change is a migration file committed with the schema; `prisma db push` is disabled.
- CI replays all migrations on an empty database and fails if the schema differs from the migrations.
- Expand → deploy → contract. Additive first; destructive changes in a later release.
- Unknown history is NULL/"legacy", never fabricated.
- Production migrations are applied manually with `db:deploy --confirm <db>` after a backup; builds do
  not migrate (Koma's `vercel-build` migrated on every deploy, which couples a code rollback to schema).

## Consequences
- Deploy order matters for non-additive changes; the procedure is in PRODUCTION_READINESS.md §5.
- The schema is split by ownership; the `User` model carries a small, marked block of domain
  back-relations (Prisma requirement).
