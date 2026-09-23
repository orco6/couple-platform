# 0013 — The preview database is migrated from inside one flagged build

Status: Accepted (2026-09-23)

## Context
ADR 0004 and 0006 say builds never migrate, and `DEPLOY_PREVIEW.md` ran `db:deploy` and the preview
seed from the operator's machine with the direct connection string. Vercel's Neon integration stores
every connection variable as **Sensitive**: `vercel env pull` writes them as `[SENSITIVE]`, and no CLI
or API call returns the value (the store's secrets endpoint refuses a CLI token). The value exists only
inside Vercel's builds and functions. `deploy-preview.mjs` parsed the pulled placeholder as a URL and
failed — not a database problem, a wrong assumption about where the credential can be read.

The alternatives were: copying the string by hand from the Neon console into a shell (a manual step, a
secret on the laptop and in shell history); marking the variables non-sensitive (weakens the
protection to make a script easier); or running the migration where the credential already is.

## Decision
- `vercel-build` runs `scripts/preview-database.mjs`, then `next build`. The step is a **no-op** unless
  the build is a Vercel **preview** (`VERCEL=1`, `VERCEL_ENV=preview`) **and** the deployment was created
  with `PREVIEW_DB_SETUP=1` — a per-deployment `--build-env` that only `npm run deploy:preview` passes,
  never a project variable. A push to `main` builds without touching the schema; a production build
  never migrates, and a production build carrying the flag fails.
- It confirms the database by name exactly as `db:deploy --confirm` does (`PREVIEW_DB_CONFIRM` must
  equal the name in the connection string), then runs the guarded `db.ts deploy` and the preview seed
  with `--skip-if-seeded`. Both are idempotent, so every `deploy:preview` can repeat them.
- The review passwords never leave the operator's machine: `scripts/preview-credentials.ts` writes them
  to the credentials file outside the repository and hands the deployment only their scrypt hashes.
- The deploy script checks the database is connected by variable **name** (`vercel env ls`), never by
  value, and does not copy `DATABASE_URL_UNPOOLED` into `DIRECT_URL` (the runtime does not use it).

## Consequences
- Production is unchanged: ADR 0004's manual `db:deploy --confirm` after a backup is still the only
  way a production schema moves. This exception is preview-only and opt-in per deployment.
- A failed migration fails that build, so the alias never moves to code whose schema did not apply.
- Rolling a preview back to an older deployment does not roll its schema back (the ADR 0004 concern);
  acceptable for a review database holding only fictional data.
- On this Git-less project a bare `vercel deploy` targets **production**. The first run of the new
  script did exactly that; the build step saw `VERCEL_ENV=production`, refused the flag, and the
  build failed before anything was migrated or served. The script now passes `--target preview`.
