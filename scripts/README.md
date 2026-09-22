# scripts

| Script | Safety |
|---|---|
| `db.ts migrate-dev / reset-local / seed-dev` | local `_dev` only (`core/db/safety.ts`) |
| `db.ts deploy --confirm <db>` | any database, prints target, requires its exact name |
| `qa-data.ts <scenario>` | local `_dev`/`_e2e` only; no HTTP equivalent exists on purpose |
| `bootstrap-owner.ts` | refuses if any user exists; `--confirm <db>` |
| `backup.ts` | read-only `pg_dump` to `backups/` (gitignored) |
| `escape-invisible.mjs [--check]` | lint helper: no invisible/control characters in source |
| `lib/fixtures.ts` | scenario data created through the domain services |
