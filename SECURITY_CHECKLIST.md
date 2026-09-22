# Security checklist

Walk this for every new project and every significant feature. Each line names the control in this
repository and the test that proves it. "Implemented in core" is not "done for your domain" — the
domain lines must be re-verified for every new entity.

Legend: ✅ implemented and tested in the foundation · 🔁 re-verify per entity/route · ⚠️ known limitation.

## Authentication
- ✅ Passwords hashed with scrypt, per-hash salt, parameters upgradable — `core/auth/password-hash.ts`, `tests/unit/core/passwords.test.ts`
- ✅ Password input normalized identically client/server (bidi, zero-width, NFC, edges) — `password-input.ts`, E2E "pasted passwords"
- ✅ Policy: length 10–256, common/repeated/username-containing rejected; no composition rules — `password-policy.ts`
- ✅ Uniform failure (message, status, timing) for unknown user / wrong password / disabled / unknown role — `sign-in.ts`, `tests/integration/core/auth.test.ts`
- ✅ Brute force: DB-backed per-username and per-client throttles, atomic increments, hashed keys — `throttle.ts`, auth tests
- ✅ A missing/unknown client address never becomes one shared lock for everyone — `sign-in.ts`, `platform.test.ts`
- ⚠️ A known username can be locked out for 15 minutes by an attacker (standard lockout trade-off); admin reset clears it
- ⚠️ Client address comes from `x-forwarded-for`, trustworthy behind Vercel only; used for throttling, never authorization
- ✅ Sessions: 256-bit random token, only SHA-256 stored, idle 7d + absolute 30d, re-validated per request — `session.ts`
- ✅ Cookie httpOnly, SameSite=Lax, Secure from protocol, `__Host-` prefix over HTTPS — `cookies.ts`, E2E headers test
- ✅ Over HTTPS only `__Host-session` is honoured: a plain `session` cookie planted by a subdomain or a
  network attacker is ignored (session fixation) — `selectSessionToken`, `security-helpers.test.ts` (mutation-checked)
- ✅ Revocation on disable, password reset, role change; own password change ends other sessions — users/auth tests
- ✅ Temporary passwords generated server-side, shown once, never stored readable/logged/audited — `users.ts`, users tests
- ✅ `mustChangePassword` enforced on pages AND API — `guards.ts`, E2E "temporary password"
- ✅ Password change requires the current password and is throttled with the sign-in username lock — `account.ts`, `platform.test.ts`
- ⚠️ No 2FA, no email-based self-service reset (administrator reset only). Add per project if required.

## Authorization
- ✅ Permission checks, not role names — `core/access/*`
- ✅ Escalation rule (manage/assign only covered roles) — `define-access.ts`, users tests
- ✅ Last active user-manager cannot be removed, including under concurrency (row lock) — users tests
- ⚠️ Equal roles cover each other: an ADMIN can reset another ADMIN's password (and so sign in as them after
  the forced change). Intended for small teams; give a business two administrator tiers if that is not acceptable
- ✅ Core code and core tests never name a role (`core/access/role-queries.ts`); the core suite runs unchanged
  against the sample, the blank domain (CI) and a clinic domain
- 🔁 Every list/get/update/delete/count uses the entity scope — `tests/integration/sample/authorization-matrix.test.ts` pattern (mutation-checked)
- 🔁 Sensitive fields a role may not read are omitted from the view by the service and kept out of audit payloads
- 🔁 Sortable lists accept only allow-listed sort keys (`parseSort`) and never change the scope
- 🔁 Views carry capability flags computed from the same rules as the service (e.g. a closed month
  removes status/price/assignee actions and says why); tests assert flags match what the service accepts
- ✅ A save refused because the session ended keeps the form (no redirect) and offers sign-in in a new
  tab; data loads still redirect with `next` — `SessionNotice`, form-safety E2E
- ✅ Follow-ups: raising one requires reaching the record, and it cannot be assigned to someone who cannot
  reach it (the note would leak) — `follow-ups.ts`, `platform.test.ts` (mutation-checked)
- ⚠️ A follow-up stays visible to its creator and assignee if they later lose access to the record (label,
  kind and note — not the record); the link then shows not-found. Follow-up notes are stored in the audit
  log: they are operational notes, not a place for clinical or financial detail
- 🔁 Out of scope → 404, identical to nonexistent
- 🔁 Authority-carrying fields (owner, assignee, price, status) checked individually
- 🔁 Page guard on every page under `(app)`; `requireActor` first line of every handler
- ✅ Proxy never makes auth decisions (defence can't be bypassed by a matcher gap)

## Input, output, injection
- ✅ All request bodies parsed with `.strict()` Zod schemas (mass assignment) — `http/handler.ts`, validation tests, E2E
- ✅ Structural test: every `*Schema` exported from `src/domain` is strict at every object level — scans each new
  business automatically (`request-schemas-strict.test.ts`; added after a mutation removing `.strict()` survived)
- ✅ Body size limit (256 KB) and JSON content-type required
- ✅ SQL: Prisma parameterized queries; raw SQL only via tagged templates (`$queryRaw\`…\``); the one
  `$executeRawUnsafe` builds a TRUNCATE from `pg_tables` names in guarded test/script code only
- ✅ XSS: React escaping; `react/no-danger` lint error; strict nonce CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`)
- ⚠️ CSP allows `style-src 'unsafe-inline'` (inline style attributes for drag geometry); scripts remain strict
- ✅ Open redirects: `safeRedirectPath` for `?next=` — unit + E2E tests
- ✅ No form can submit as GET: every `<form>` has `method="post"` (ESLint rule). Before hydration, a GET
  submit put `username` and `password` in the URL (reproduced) — `e2e/core/form-safety.spec.ts`
- ✅ Credential forms submit the values actually in the fields (password managers that fill without
  events) — `core/ui/form-values.ts`, form-safety E2E
- ✅ CSP asks for HTTPS upgrades only on HTTPS pages (a plain-http production build no longer fails to
  hydrate on WebKit / LAN phones) — `proxy.ts`, `proxy-csp.test.ts`
- ✅ Invisible/control characters in source code fail lint — `scripts/escape-invisible.mjs --check`
- 🔁 Any new free-text field rendered as HTML (e.g. rich text) needs a sanitizer and an ADR

## CSRF and headers
- ✅ SameSite=Lax + server-side same-origin check on POST/PUT/PATCH/DELETE `/api/**` — `proxy.ts`, `origin.ts`, unit + E2E
- ✅ X-Frame-Options DENY + `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy, HSTS, COOP — `next.config.ts`
- ✅ `Cache-Control: no-store` on API responses; `X-Powered-By` removed

## Errors and data exposure
- ✅ Categorized errors; unexpected errors return a generic message, details only in server logs — `errors.ts`, E2E malformed body
- ✅ Logger redacts credential-like keys; request bodies are never logged — `core/log.ts`
- ✅ Password hashes never selected outside auth; views are explicit objects — users tests
- ✅ Audit payloads redacted at every depth — `audit/redact.ts`
- 🔁 New views: select explicit fields; never return Prisma rows with relations to the client
- ✅ Health endpoint reveals nothing but ok/degraded

## Data integrity
- ✅ Audit log append-only by DB trigger — `platform.test.ts` (mutation-checked)
- 🔁 Production: the app's database role also lacks UPDATE/DELETE/TRUNCATE on `AuditEvent` and all DDL — SQL in
  PRODUCTION_READINESS.md §3 (verified on PostgreSQL 17); the trigger alone does not stop TRUNCATE by the owner
- ✅ Reason required for overrides (reopen, restore) enforced in the recorder
- ✅ Period locks with advisory locks (no write between calculate and store); snapshots superseded, never deleted
- ✅ Optimistic concurrency (`version`) for concurrently edited records
- ✅ Duplicate submissions: Idempotency-Key replay per user+scope; a key reused with a different body is refused
  (`IDEMPOTENCY_KEY_REUSED`), concurrent identical submits run once, a claim abandoned by a crashed request is
  recoverable after 2 minutes — `platform.test.ts` (mutation-checked)
- ✅ Idempotency never stores responses containing credential-like keys (user creation is not idempotent; the unique username refuses repeats) — `platform.test.ts`
- ✅ Daily housekeeping removes expired sessions, stale throttle rows and old idempotency keys; never business or audit data — `core/housekeeping.ts`, `/api/cron/housekeeping` (Bearer `CRON_SECRET`, 404 when unset)
- ✅ DB CHECK constraints for money invariants
- 🔁 New financial entities: CHECK constraints + period lock on EVERY field that changes period figures (amount, rate, person, date) + audit

## Production and environment safety
- ✅ Env validated at startup; APP_URL https required in preview/production; COOKIE_SECURE=false refused
- ✅ Destructive scripts refuse non-local hosts, wrong database suffix, or deployed APP_ENV/VERCEL_ENV — `db/safety.ts`, unit tests; integration and E2E setups guard both DATABASE_URL and DIRECT_URL
- ✅ `db push` disabled — also through `npx prisma` directly (`prisma.config.ts` → `prisma-command-guard.ts`); `migrate
  reset/dev` and `db execute` refuse non-local databases; migrations drift-checked in CI; production migrations manual
  with `--confirm <db>`
- ✅ Environment contradictions refused at startup: loopback database in preview/production, `APP_ENV` disagreeing
  with `VERCEL_ENV` — `env.ts`, `security-helpers.test.ts`; a development server pointed at a managed database host warns
- ✅ Bootstrap owner refuses non-empty installations
- ✅ `/design-system` 404 in production; no debug or seed endpoints exist
- ✅ Dependencies: `npm audit` clean (two transitive overrides inside the Prisma CLI; removal conditions in ADR 0011)
- 🔁 Backups: encrypted (`BACKUP_ENCRYPTION_PASSPHRASE`) with a read-only role before real data exists — PRODUCTION_READINESS.md §6
- ⚠️ No file uploads in the foundation. If added: size/type validation server-side, private storage, signed URLs, no user-controlled paths, malware scanning for untrusted sources
- ⚠️ No outbound HTTP from user input (no SSRF surface). If integrations add fetches to user-provided URLs: allow-list hosts
- ⚠️ Rate limiting exists only for sign-in. Add per-route limits for expensive or externally-triggered endpoints

## Red-team script (run per project, record results)
1. As staff A, call `GET/PATCH/DELETE` on staff B's record ids via curl/Playwright request context → 404.
2. Add `ownerId`, `role`, `status`, `createdById`, `priceAgorot` to requests that do not accept them → 400/403.
3. Call every `/api/admin/**` route as each non-admin role → 403.
4. Sign in, disable the account from another session, reuse the old cookie → 401.
5. Replay a create request with the same Idempotency-Key → one record.
6. Submit a cross-origin POST with a valid cookie → 403.
7. `?next=//evil.com` on login → lands on `/`.
8. Malformed JSON, 1 MB body, `31.04.2026`, `-5` money, `1e3` money → clean 400s.
9. Edit a record belonging to a closed period → 422 PERIOD_CLOSED.
10. Try `UPDATE "AuditEvent"` in a SQL console → rejected; as the runtime role, `TRUNCATE "AuditEvent"` → permission denied.
11. Reuse an Idempotency-Key with a different body → 422 `IDEMPOTENCY_KEY_REUSED`.
12. Send a request with both `__Host-session` (yours) and `session` (someone else's) over HTTPS → acts as you.
13. As a role without a sensitive-field permission, read the record via page, API and print → the field is absent.
14. Assign a follow-up on a private record to a colleague who cannot see it → refused.
15. `?sort=passwordHash` / unknown sort keys on list pages → default order, no error, no extra data.
