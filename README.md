# Business Platform Foundation

A reusable, production-grade starting point for **bespoke small-business software**: Hebrew-first,
RTL-native, secure by structure, and designed to be adapted by AI agents from a short business brief.

It is not a no-code platform, an ERP or a demo. It is the part of every serious business app that
should not be rebuilt each time — authentication, authorization, audit, money, dates, period close,
forms, dialogs, printing, tests, CI and production safety — with a small removable sample domain
proving it all works end to end.

```
Next.js 16 · React 19 · TypeScript (strict) · Prisma 7 · PostgreSQL · Zod 4 · Tailwind 4 · Vitest · Playwright
```

## Start here

| You want to… | Read |
|---|---|
| Understand the architecture, what is core and what is domain | [FOUNDATION.md](FOUNDATION.md) |
| Build a new business app from this repository | [NEW_BUSINESS_PROJECT_PROMPT.md](NEW_BUSINESS_PROJECT_PROMPT.md) + [BUSINESS_BRIEF_TEMPLATE.md](BUSINESS_BRIEF_TEMPLATE.md) |
| Add an entity, role, report or workflow | [DOMAIN_IMPLEMENTATION_CHECKLIST.md](DOMAIN_IMPLEMENTATION_CHECKLIST.md) |
| Ship to production | [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) |
| Review security | [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) |
| Review design | [DESIGN_REVIEW.md](DESIGN_REVIEW.md) |
| Build a screen well | [docs/SCREEN_BUILDING_PLAYBOOK.md](docs/SCREEN_BUILDING_PLAYBOOK.md) + [docs/DESIGN_PATTERN_LIBRARY.md](docs/DESIGN_PATTERN_LIBRARY.md) |
| Test by hand before a release | [MANUAL_QA.md](MANUAL_QA.md) |
| Record business rules with the client | [BUSINESS_RULES_TEMPLATE.md](BUSINESS_RULES_TEMPLATE.md) |
| Know why something is the way it is | [docs/adr/](docs/adr/) |

## Local development

Requirements: Node 22.12+, Docker.

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # local defaults work as-is
npm run db:up               # PostgreSQL 17 on 127.0.0.1:5436 (couple_platform_dev, couple_platform_test, couple_platform_e2e)
npm run db:reset:local      # migrate + realistic sample data (local _dev database only)
npm run dev                 # http://localhost:3000
```

Every declared role has two local users, `<role>` and `<role>2` — with the sample: `owner`, `admin`,
`manager`, `staff` (and `owner2`, …) — password `yesod-dev-password` (local and E2E databases only; the
seed refuses anything else). `pending` must choose a new password on first sign-in; `disabled` cannot
sign in. The component gallery is at `/design-system` (not in production).

## Starting a business project

```bash
npm run foundation:new-business -- --name "שם העסק" --slug latin-slug --db-port 5435
```

Renames local infrastructure, removes the sample domain, installs the blank domain. Full walkthrough:
[NEW_BUSINESS_PROJECT_PROMPT.md](NEW_BUSINESS_PROJECT_PROMPT.md).

## Commands

| Command | What it does |
|---|---|
| `npm run check` | typecheck + lint + unit + integration |
| `npm run typecheck` / `npm run lint` | TypeScript strict / ESLint + invisible-character check |
| `npm run test:unit` | pure tests, no database |
| `npm run test:integration` | real PostgreSQL (`couple_platform_test`, rebuilt from migrations, emptied before every test) |
| `npm run e2e` | Playwright on a production build against `couple_platform_e2e` (desktop + mobile) |
| `npm run qa:screenshots` | screenshot sweep for design review: every screen at 1440px and iPhone WebKit → `screenshots/qa/` |
| `npm run db:migrate:dev -- --name <change>` | create and apply a migration (local `_dev` only) |
| `npm run db:deploy -- --confirm <database>` | apply migrations to a named database, after printing the target |
| `npm run qa:data -- <minimal\|realistic>` | replace local data with a scenario (local `_dev`/`_e2e` only) |
| `npm run db:bootstrap-owner -- --name … --username … --confirm <db>` | first account in an EMPTY installation |
| `npm run db:backup` | manual `pg_dump` to `backups/` |
| `npm run foundation:new-business -- …` | convert a fresh clone into a business project (`--dry-run` first) |
| `npm run db:push` | disabled on purpose — use migrations (also refused via `npx prisma db push`) |

## Repository map

```
src/core/      CORE PLATFORM — stable, rarely modified (auth, access, audit, db, money, dates, ui…)
src/domain/    BUSINESS DOMAIN — replaced per project (roles, entities, rules, navigation, seams)
src/brand/     IDENTITY — name, legal details for print, locale, theme tokens, logo
src/app/       Routes: core screens + one route group per business area, e.g. (app)/(sample)
prisma/schema/ core.prisma (stable) + domain.prisma (per project)
scripts/       Guarded database scripts, fixtures, backup, new-business conversion
templates/     blank-domain: what a new project starts from
tests/         unit/ and integration/, each split into core/ and <area>/ (Vitest)
e2e/           core/ and <area>/ (Playwright)
docs/adr/      Architecture decisions
```
