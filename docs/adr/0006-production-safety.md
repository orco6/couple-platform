# 0006 — Production safety

Status: Accepted (2026-09-16)

## Context
The worst realistic failures are not attacks but operator mistakes: a shell with a production
`DATABASE_URL` exported running a test reset; a seed script run against the wrong database; Prisma
migration commands reading `DIRECT_URL` while a guard checked `DATABASE_URL` (a Koma near-miss; the same
fall-through was caught by the guard while writing this foundation's test setup).

## Decision
- `core/db/safety.ts → assertSafeForDestructiveOperation(operation, url, env)` refuses unless ALL hold:
  local host (or the CI service host with `CI=true`), database name suffix allowed for the operation
  (`_test`, `_e2e`, `_dev`), and `APP_ENV`/`VERCEL_ENV` not indicating a deployed environment.
- Every destructive path calls it: integration/E2E global setups (on both `DATABASE_URL` and
  `DIRECT_URL`), per-test truncation, `db:reset:local`, `db:seed:dev`, `qa:data`.
- Suites pin their URLs explicitly before importing anything that loads `.env`.
- QA data is script-only — no HTTP endpoint that could reach production.
- Production-touching scripts (`db:deploy`, `db:bootstrap-owner`) print the target and require
  `--confirm <database-name>`; bootstrap refuses non-empty installations.
- `db push` disabled; builds never migrate; env validation refuses insecure production settings.
- The audit table rejects UPDATE/DELETE at the database level.

## Consequences
- Running a destructive script against a remote database is impossible without editing core code — by
  design. Legitimate remote operations (migrations, backups, bootstrap) have their own confirmed paths.
