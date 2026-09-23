# Deploying the review environment

One environment: **Preview**. No production, no real data, a database that exists only for this
review. The path is PRODUCTION_READINESS.md §3 with the preview-specific parts filled in; nothing
here is new, and every command below was run end-to-end against a fresh database before it was
written down.

**Prerequisites:** the Vercel account that owns the repository, Node 22+, and this repo checked out
at `C:\Users\orcoh\projects\couple-platform`.

## The short version

```bash
cd C:\Users\orcoh\projects\couple-platform
npm ci
npm run deploy:preview
```

That script does every step below that a CLI can do, and it is idempotent — run it again after
anything you finish in the browser and it picks up where it stopped. It pauses at exactly the two
things Vercel only offers in a browser:

1. **Signing in.** It opens the Vercel login; approve it.
2. **Creating the database.** Vercel provisions integration storage through the dashboard only —
   there is no CLI command and no stable public API for it — so the script prints the four clicks
   (Neon → `eu-central-1` → name `couple-platform-preview` → connect to **Preview only**) and waits
   for you to run it again.

The project is `or73/couple-platform`, and `or73` is not the personal scope, so every command runs
with `--scope or73`. Without that, `vercel link` would create a *second* project of the same name in
the personal account. Override with `VERCEL_SCOPE` if the team is renamed.

Then it links the project, sets the Preview variables (`APP_URL`, `CRON_SECRET`, and
`VERCEL_PREVIEW_FEEDBACK_ENABLED=0`, which turns the Vercel Toolbar off for Preview — its injected
script is correctly refused by this app's nonce CSP; turning the toolbar off is the fix, widening the
CSP is not), deploys as a **preview** (never `--prod`) whose build migrates and seeds the database,
claims the stable alias, and runs the smoke test when it can get through Deployment Protection.

**Why the build migrates — and only this one.** The Neon integration stores its connection strings
as Sensitive variables: `vercel env pull` writes them as `[SENSITIVE]`, and no CLI hands the value
out. So the script never reads a credential. It checks the variables exist by name, and passes the
one deployment it creates `--build-env PREVIEW_DB_SETUP=1`; that build's `vercel-build` step
(`scripts/preview-database.mjs`) runs the guarded `db:deploy` and the preview seed where the value
already is, then `next build`. A push to `main` does not carry the flag and never migrates; a
production build never migrates. The review passwords stay on this machine — the deployment is given
only their scrypt hashes. See [ADR 0013](docs/adr/0013-preview-database-setup.md).

Deployment Protection stays **on**. For the smoke test to get through it, create a **Protection
Bypass for Automation** secret (Settings → Deployment Protection) and run
`VERCEL_AUTOMATION_BYPASS_SECRET=<secret> npm run deploy:preview`; without it, the smoke step is skipped.

### The GitHub connection

It is not used by any of this. `vercel deploy` uploads the working directory, so a broken Git link
cannot stop a review. The repository is **public** and owned by the user `orco6`, so visibility is
not the cause; a Vercel *team* does not inherit a personal GitHub App installation, which is the
usual reason a team project cannot connect to a personal repository. To fix it anyway, install the
Vercel GitHub App for `orco6` and grant it `couple-platform`:
<https://github.com/apps/vercel/installations/select_target>. (If you do, `main` pushes will build
previews that do not migrate — see §4 — and check that the Production Branch is not `main`, §1.2.)

The rest of this file is the same path by hand, and the reference for anything that goes sideways.

---

## 1. Vercel project

1. **Add New → Project → import `orco6/couple-platform`.** Framework Next.js; build and output
   settings default (`npm run build`). **Do not deploy yet** — press "Environment Variables" first,
   or cancel the first build and set them below.
2. **Settings → Git → Production Branch:** set it to `production` (a branch that does not exist).
   `main` then builds as a **Preview** deployment, which is the whole point: `VERCEL_ENV=preview`
   gives `APP_ENV=preview`, and no production environment is ever created.
3. **Settings → General → Vercel Toolbar: off** for this project. The toolbar injects a script that
   this app's nonce-based CSP correctly refuses; turning the toolbar off is the fix, never widening
   `script-src`.
4. **Settings → Deployment Protection:** leave **Standard Protection** on. Under *Protection Bypass
   for Automation*, create a secret and copy it — the smoke test uses it, and nothing else needs it.

## 2. Database — a new one, for this review only

**Storage → Create Database → Neon (Postgres)**, region `eu-central-1`, name **`couple-platform-preview`**.
Connect it to this project and, when asked which environments, choose **Preview only**.

Vercel injects `DATABASE_URL` (pooled, what the app runs on) and `DATABASE_URL_UNPOOLED` (direct,
what migrations use), both Sensitive. Add:

| Variable | Environment | Value |
|---|---|---|
| `APP_URL` | Preview | `https://couple-platform-review.vercel.app` (step 5) |
| `CRON_SECRET` | Preview | any 24+ random characters (Sensitive) |
| `VERCEL_PREVIEW_FEEDBACK_ENABLED` | Preview | `0` — the Vercel Toolbar off |

`APP_ENV` is derived from `VERCEL_ENV` — do not set it. `COOKIE_SECURE` — do not set it. `DIRECT_URL`
is not needed at runtime.

## 3. Migrate and seed

`npm run deploy:preview` does this from inside its own preview build (see *The short version*),
because the connection strings are Sensitive and never reach your machine. By hand — only with the
**unpooled** string from the Neon console, and never pasted into a chat or a file in the repo:

```bash
cd C:\Users\orcoh\projects\couple-platform
npm ci

# The database name is the last path segment of the URL, usually "neondb".
set DATABASE_URL=<unpooled url>
npm run db:deploy -- --confirm neondb
npm run db:seed:preview -- --confirm neondb
```

`db:deploy` prints what it is about to apply and refuses without the exact database name.
`db:seed:preview` refuses if the database already has a user, so it cannot overwrite a review in
progress.

The passwords live in **`C:\Users\orcoh\projects\couple-platform-review-credentials.txt`**
(outside the repository, mode 600). `deploy:preview` writes it before deploying and reuses it on every
re-run; the hand-run seed prints and writes it itself. The accounts:

- `review-partner-a` — נועה ברק, OWNER
- `review-partner-b` — מיכל ביטון, PARTNER

The two are linked as a couple, and the data is the fictional set from `src/domain/dev-data.ts`:
today's shared list with tasks owned by each of them, a completed task waiting for the other's
rating, tasks already rated, 27 days of daily reviews behind the reveal, a full week and a full
month of summaries, and one archived task. The shared review hour is set to `00:00` so the day can
be closed whenever the review happens.

### Least-privilege runtime role (recommended, ~2 minutes)

Vercel's Neon integration connects as an owner role. To make the deployment's own connection unable
to rewrite history, run this **as the owner, after `db:deploy`**, in the Neon SQL editor, then point
Preview's `DATABASE_URL` at the new role's **pooled** string (leave `DATABASE_URL_UNPOOLED` as the owner's):

```sql
CREATE ROLE app_runtime LOGIN PASSWORD '<generated>';
GRANT CONNECT ON DATABASE neondb TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM app_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "_prisma_migrations" FROM app_runtime;
```

Skipping it is defensible for a preview holding fictional data; the append-only audit trigger still
applies either way. PRODUCTION_READINESS.md §3 is the full version, backup role included.

## 4. Deploy

`npm run deploy:preview`. If a Git connection is ever added, a push to `main` builds a preview that
does **not** migrate (it lacks the per-deployment flag), so use `deploy:preview` after schema changes.

## 5. A stable review URL

**Settings → Domains → Add** `couple-platform-review.vercel.app`, assign it to branch `main`. Every
`main` preview then answers on the same address, so the link on the phone never goes stale. Set
`APP_URL` to exactly that origin and redeploy once (the same-origin check compares against it).

## 6. Smoke test

```bash
set SMOKE_BASE_URL=https://couple-platform-review.vercel.app
set VERCEL_AUTOMATION_BYPASS_SECRET=<from step 1.4>
set REVIEW_PASSWORD_A=<from the credentials file>
set REVIEW_PASSWORD_B=<from the credentials file>
npm run smoke
```

Four checks, phone-sized, against the real deployment: health and security headers; both partners
signing in, the shared list, completing, the owner refused their own task's stars, the partner
rating it, and the write surviving a reload; the day closing, waiting and revealing; the summaries
and the bottom bar. It writes only its own rows and leaves **today** unclosed, so the closing ritual
is still there for you to do.

Deployment Protection stays on throughout — the bypass secret is what lets the test through, and it
is not a change to the app.

---

## Known deviation from the foundation (backport candidate)

`scripts/db.ts deploy` ran `prisma migrate status` through `run()`, which throws on a non-zero exit.
`migrate status` exits 1 whenever migrations are pending — **always true on a fresh database** — so
the guarded deploy script aborted before `migrate deploy` and the first deployment to a new database
could not be made with it. Fixed here by running the status for its output rather than its exit code
(`report()` in `scripts/lib/database.ts`). Reproduced and verified against an empty PostgreSQL 16
database. Not yet applied to `business-platform-foundation`.
