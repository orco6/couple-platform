# 0011 — Stack and versions

Status: Accepted (2026-09-16)

| Choice | Version | Why |
|---|---|---|
| Next.js | 16.3 | Current stable major (proxy.ts, async request APIs); a foundation cloned for years should not start a major behind. Koma runs 15.5. |
| React | 19.x | Required by Next 16. |
| Prisma | 7.10 (pinned; 8.0 is RC) | Driver adapters (`@prisma/adapter-pg`) and `prisma.config.ts`; multi-file schema for the core/domain split. |
| PostgreSQL | 17 locally/CI; Neon in production | Same engine everywhere. |
| TypeScript | 5.9 | typescript-eslint does not yet support 6.x/7.x. `strict` + `noUncheckedIndexedAccess`. |
| Zod | 4.x | Runtime validation shared by client hints and server. |
| Tailwind CSS | 4.x | CSS-first theme with semantic tokens. |
| Vitest | 4.1 | 5.0 was two weeks old at creation. |
| Playwright | 1.63 | Chromium desktop + Pixel 7 emulation in CI (WebKit can be added per project). |
| ESLint | 9 + eslint-config-next 16 | Flat config; `next lint` no longer exists. |

Not included, deliberately: Redis (sessions and throttling live in Postgres), a UI kit, a motion
library, an ORM-level soft-delete extension (explicit filters are clearer), an auth provider SaaS
(administrator-managed accounts fit small businesses), Docker for production (Vercel).

## npm overrides (temporary)

`package.json → overrides` forces `mysql2 ^3.24.4` and `deepmerge-ts ^8.0.2`. Both are pulled in only by the
Prisma **CLI** (`prisma@7.10.0` depends on `mysql2 3.15.3`; `@prisma/config@7.10.0` on `deepmerge-ts 7.1.5`),
whose versions `npm audit` flagged. Neither is loaded by the running application: the app uses PostgreSQL
through `@prisma/adapter-pg`, and `deepmerge-ts` only merges CLI config.

Risk accepted: `deepmerge-ts` is forced across a major version (7 → 8) inside the CLI's config loader. It is
covered by every CI run (`prisma generate`, `migrate deploy`, `migrate diff` all load the config).

**Remove an override when all of these hold** (check on every Prisma upgrade):
1. A **stable** Prisma release (not `-rc`; on 2026-09-16 the `latest` tag pointed at `8.0.0-rc.15`) depends on
   `mysql2` ≥ 3.24.4 / `@prisma/config` depends on `deepmerge-ts` ≥ 8.0.2 — or no longer depends on them.
2. After deleting the override and `npm install`: `npm ls mysql2 deepmerge-ts` shows the new versions, and
   `npm audit` (full, not only `--omit=dev`) reports 0 vulnerabilities.
3. `npm run check`, `npm run e2e` and the CI migration drift check pass.

Verified state on 2026-09-16: `npm audit` 0 vulnerabilities with the overrides; `npm ls` resolves
`mysql2@3.24.4` and `deepmerge-ts@8.0.2`.
