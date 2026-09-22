# Production readiness

Deployment target: **Vercel** (Next.js) + **Neon** (or any managed PostgreSQL 15+). Nothing in the
code is Vercel-specific except reading `VERCEL_ENV`/`VERCEL_GIT_COMMIT_SHA`.

> **Status of this repository:** nothing is deployed, no production database exists, and **no backups
> are configured**. Every item below is a per-project task. Do not mark it done because the foundation
> "supports" it.

## 0. What the foundation implements vs what each business must do

| Area | IMPLEMENTED in the foundation (tested) | PER BUSINESS (not done until you do it) |
|---|---|---|
| Environment safety | typed env; refuses loopback DB in preview/production, `APP_ENV` contradicting `VERCEL_ENV`, insecure cookies outside development | set real variables per Vercel environment |
| Destructive commands | reset/seed/`migrate dev`/`db execute` refuse non-local or wrongly-suffixed databases; `db push` refused even via `npx prisma` | never work around the guard |
| Migrations | migration-only schema changes; CI replays history and fails on drift | review SQL; expand → contract; run `db:deploy` manually |
| Auth / sessions | scrypt, DB sessions, throttling, revocation, bootstrap-owner script | create the first owner; remove test accounts |
| Audit | append-only trigger | least-privilege runtime role so TRUNCATE is also impossible (§3) |
| Backups | workflow with dump verification and optional AES-256 encryption (disabled) | secrets, schedule, retention, off-GitHub monthly copy, restore drill (§6–7) |
| Monitoring | `/api/health`, structured error logs without bodies | uptime monitor, log alerting |
| Housekeeping | cron endpoint behind `CRON_SECRET` | set the secret |
| Privacy | scoping, field-level reads, redaction in audit | data inventory, retention, export/erasure procedure with the client |

## 1. Environments

| Environment | `APP_ENV` | Database | Who uses it |
|---|---|---|---|
| development | `development` | local `*_dev` (Docker) | developers |
| test | `test` | local/CI `*_test` (rebuilt per run) | integration suite |
| e2e | `test` | local/CI `*_e2e` (rebuilt per run) | Playwright |
| preview | `preview` (from `VERCEL_ENV`) | **separate** Neon branch/database — never production | reviewers, the client |
| production | `production` | production database | the business |

Rules: preview never points at production data. Destructive scripts refuse anything that is not
local + correctly suffixed + non-deployed `APP_ENV` (`src/core/db/safety.ts`).

## 2. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** string (`-pooler` host), `?sslmode=require` |
| `DIRECT_URL` | recommended | Neon **direct** string — used only by migrations |
| `APP_URL` | preview + production | `https://…`; used for the same-origin check |
| `APP_ENV` | no on Vercel | derived from `VERCEL_ENV`; set explicitly elsewhere |
| `COOKIE_SECURE` | no | leave unset (derived from protocol); `false` is refused outside development |
| `LOG_LEVEL` | no | `info` default |
| `CRON_SECRET` | recommended | ≥24 random characters; enables daily housekeeping via `vercel.json` cron. Without it the endpoint is a 404 and expired rows accumulate (harmless, but untidy) |

Set them in Vercel → Project → Settings → Environment Variables, separately for Preview and Production.
Never in the repository. `.env.example` lists names only.

## 3. First deployment (per project)

1. **Database.** Create a Neon project (region near Israel, e.g. `eu-central-1`). Create a `production`
   branch and a `preview` branch. The **owner** role runs migrations only (`DIRECT_URL` on a trusted
   machine). The app connects as a **runtime** role that cannot change schema, truncate tables or rewrite
   the audit log; backups use a **read-only** role. Run as the owner, after the first `db:deploy`
   (verified against PostgreSQL 17 — the runtime role could read, write and append audit events, and
   was refused UPDATE/DELETE/TRUNCATE on `AuditEvent`, `CREATE TABLE`, `TRUNCATE` and writes to
   `_prisma_migrations`; the backup role could dump and could not delete):
   ```sql
   CREATE ROLE app_runtime LOGIN PASSWORD '<generated>';
   CREATE ROLE app_backup  LOGIN PASSWORD '<generated>';
   GRANT CONNECT ON DATABASE <db> TO app_runtime, app_backup;
   GRANT USAGE ON SCHEMA public TO app_runtime, app_backup;

   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
   REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM app_runtime;
   REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "_prisma_migrations" FROM app_runtime;

   GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_backup;
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backup;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_backup;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO app_backup;
   ```
   `ALTER DEFAULT PRIVILEGES` covers tables created later **by the role that runs it** — run it as the
   same owner role that runs migrations. `DATABASE_URL` (Vercel) = `app_runtime` pooled;
   `BACKUP_DATABASE_URL` = `app_backup` direct.
2. **Migrate** (from a trusted machine):
   ```bash
   DATABASE_URL="<direct production url>" npm run db:deploy -- --confirm <database-name>
   ```
3. **First owner** (refuses if any user exists):
   ```bash
   DATABASE_URL="<direct production url>" npm run db:bootstrap-owner -- --name "שם" --username owner --confirm <database-name>
   ```
   Hand over the printed temporary password in person or by phone; it must be changed at first sign-in.
4. **Vercel project.** Import the GitHub repository; framework Next.js; build command `npm run build`
   (the default). Set environment variables per environment. **The build does not run migrations.**
5. **Domain.** Vercel → Domains → add the business domain; set DNS (CNAME to `cname.vercel-dns.com`, or
   A record for apex). HTTPS is automatic. Set `APP_URL` to the final origin and redeploy.
6. **Verify:** `/api/health` → `{"status":"ok"}`; sign in; change password; response headers include CSP
   and HSTS; `/design-system` returns 404.
7. **Backups:** complete §6 before real data is entered.

## 4. Deploying a change

1. PR → CI green (typecheck, lint, audit, unit, integration, migration drift, build, E2E).
2. Vercel preview deployment → check against the preview database → MANUAL_QA.md for touched areas.
3. If the change has a migration: see §5 **before** merging.
4. Merge → Vercel production deployment.
5. Watch logs for 15 minutes (`api.unexpected_error`), check `/api/health`.

## 5. Migrations

Principles (ADR 0004):
- Every schema change is a migration file, reviewed as SQL. `db push` is disabled.
- **Expand → deploy → contract.** Additive first (new nullable column / new table), deploy code that
  works with both shapes, backfill if needed, then a later migration tightens or removes.
- Never rename or drop a column in the same deployment as the code that stops using it.
- Never fabricate history: unknown values stay NULL / "legacy" / "unclassified".
- Never reset or seed production. Scripts refuse; do not work around them.

Production procedure:
1. Take a backup (§6) or confirm Neon point-in-time restore covers now.
2. `npm run db:migrate:status` against production (read-only).
3. Apply **before** deploying code that needs the new schema (additive migrations are safe with old code):
   `DATABASE_URL="<direct url>" npm run db:deploy -- --confirm <db>`
4. Deploy the code.
5. A failed migration: Prisma records it as failed. Do **not** run it again blindly. Read the error, fix
   forward with a new migration, or restore (§7). `prisma migrate resolve` only after understanding.

Automation of production migrations is intentionally absent. If a project adds it later, it must
require a manual approval step and a backup step, and be documented in an ADR.

## 6. Backups (configure per project — NOT configured now)

Two independent layers, because they fail for different reasons:

| Layer | Covers | Configure |
|---|---|---|
| Neon point-in-time restore | accidents noticed within the retention window | Neon → Project settings → history retention (plan-dependent; check the real number in the dashboard, do not trust documentation) |
| Nightly logical dump off-provider | older incidents, loss of the Neon project or account | `.github/workflows/backup.yml`: secrets `BACKUP_DATABASE_URL` (`app_backup`, direct URL) and `BACKUP_ENCRYPTION_PASSPHRASE`, optional variable `BACKUP_RETENTION_DAYS`, uncomment `schedule`, run once |

**Encryption.** With `BACKUP_ENCRYPTION_PASSPHRASE` set, the dump is encrypted (gpg, AES-256) before
upload and no plaintext leaves the runner (round-trip and wrong-passphrase refusal verified). Without
it the job warns and uploads plaintext — anyone with read access to the repository can then read the
business's data. **Store the passphrase outside GitHub as well** (the owner's password manager): a
backup nobody can decrypt is not a backup.

**Retention.** GitHub artifacts are a rolling convenience window (`BACKUP_RETENTION_DAYS`, default 30,
capped by the plan), not an archive. For real client data also keep a monthly encrypted copy off
GitHub (download the artifact to the client's storage, or a bucket with its own retention) for as long
as the business's record-keeping obligations require — decide the number with the client and write it
here.

- [ ] Neon retention window confirmed: ____ days
- [ ] Backup workflow enabled, first run green: ____ (date)
- [ ] Restore drill completed (§7): ____ (date), duration ____

Manual backup any time: `npm run db:backup -- --url "<direct url>"`.

## 7. Restore and disaster recovery

**Before touching anything: take a dump of the current state, even if broken.**

| Situation | Smallest fix |
|---|---|
| Wrong data entered/deleted by a person | Fix in the app: archive/restore, soft-deleted rows still exist, audit log shows before/after |
| Bad data across many rows, noticed within Neon retention | Neon: restore a **branch** to a point in time, compare, copy the needed rows back |
| Database lost / Neon account problem | Restore the latest dump into a new database (below), point `DATABASE_URL`/`DIRECT_URL` at it |
| Bad deployment (code) | Vercel → Deployments → previous → "Promote to Production" (instant rollback) |
| Bad migration | Roll code back; fix forward with a new migration; restore only if data was destroyed. There are no automatic "down" migrations: an additive migration is harmless to old code, which is why expand → contract matters |

Restore a dump into a scratch database first, verify, then switch:
```bash
sha256sum -c backup-YYYYMMDD-HHMM.sql.gz.gpg.sha256  # artifact not corrupted
gpg --decrypt backup-YYYYMMDD-HHMM.sql.gz.gpg | gunzip > backup-YYYYMMDD-HHMM.sql   # asks for the passphrase
createdb restored_check                              # or a new Neon branch/database
psql "<target url>" -v ON_ERROR_STOP=1 -f backup-YYYYMMDD-HHMM.sql
psql "<target url>" -c 'select count(*) from "User"; select count(*) from "AuditEvent";'
DATABASE_URL="<target url>" npx prisma migrate status  # history intact
```
Restore drill: do this quarterly against a scratch database and record the date above.

**Git recovery:** GitHub is the source of truth; every developer clone is a copy. Protect `main`
(require CI, no force-push). Recover a bad merge with `git revert`, not history rewriting.

**Secret recovery:** secrets live only in Vercel/Neon/GitHub settings. If leaked: rotate the Neon role
password, update `DATABASE_URL`/`DIRECT_URL` in Vercel, redeploy. Sessions are database rows — to
sign everyone out, `DELETE FROM "Session";` (users simply sign in again).

**Emergency admin access** (nobody can sign in as an administrator):
1. Prefer: an existing OWNER/ADMIN resets the password in the app.
2. If none can: from a trusted machine with the direct URL, in a transaction, set a known user's
   `mustChangePassword = true` and `passwordHash` to a hash generated with
   `npx tsx -e "import('./src/core/auth/password-hash.ts').then(m=>m.hashPassword('<temp>')).then(console.log)"`,
   `DELETE FROM "Session" WHERE "userId" = '<id>'`, and record what you did and why in the incident log
   (the audit table rejects edits, and a manual INSERT with `actorLabel = 'emergency access'` is appropriate).
3. The person signs in and must choose a new password immediately.

## 8. Operational checklist before go-live

- [ ] All §3 steps done; `APP_URL` set; custom domain on HTTPS
- [ ] §6 backups configured and a restore drill completed
- [ ] Owner account created via bootstrap; test accounts removed or disabled
- [ ] SECURITY_CHECKLIST.md walked for this project's domain
- [ ] MANUAL_QA.md passed on a real phone and a real desktop
- [ ] Vercel: production branch protection, preview deployments not public if data is sensitive (Vercel Authentication)
- [ ] GitHub: branch protection on `main`, 2FA for all collaborators, repository private
- [ ] Neon: IP allow-list or at least strong role passwords; the app uses `app_runtime`, never the owner role (§3)
- [ ] Uptime monitor on `/api/health`
- [ ] Privacy: what personal data is stored, retention, who can export — written down with the client
- [ ] The business knows how to reach support and how a password reset works
