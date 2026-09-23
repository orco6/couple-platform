# scripts

| Script | Safety |
|---|---|
| `db.ts migrate-dev / reset-local / seed-dev` | local `_dev` only (`core/db/safety.ts`) |
| `db.ts deploy --confirm <db>` | any database, prints target, requires its exact name |
| `qa-data.ts <scenario>` | local `_dev`/`_e2e` only; no HTTP equivalent exists on purpose |
| `bootstrap-owner.ts` | refuses if any user exists; `--confirm <db>` |
| `seed-preview.ts` | refuses if any user exists (`--skip-if-seeded`: no-op); `--confirm <db>` |
| `preview-credentials.ts` | writes the review passwords OUTSIDE the repo; prints only their hashes |
| `preview-database.mjs` | `vercel-build` step: no-op unless a flagged Vercel PREVIEW build (ADR 0013) |
| `deploy-preview.mjs` | preview only, never `--prod`; never reads a database credential |
| `backup.ts` | read-only `pg_dump` to `backups/` (gitignored) |
| `escape-invisible.mjs [--check]` | lint helper: no invisible/control characters in source |
| `lib/fixtures.ts` | scenario data created through the domain services |
