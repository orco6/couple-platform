# 0012 — Converting the foundation into a business: script, template, injected seams

Status: Accepted (2026-09-16)

## Context
The first version said "delete the sample" as a manual checklist. An independent review found that
following it would break the build: core tests, fixtures, E2E helpers and generic screens (attention,
follow-ups, home) imported the sample domain or hardcoded its role names (MANAGER, STAFF). Two projects
cloned side by side would also have shared a Docker container, volume and database names.

## Decision
- **Sample ownership is explicit.** Sample code lives in route groups `(sample)` under `src/app/(app)`,
  `src/app/api` and `src/app/print`, in `src/domain/sample`, `tests/{unit,integration}/sample`, `e2e/sample` and
  the `*_sample_domain` migration — listed once in `SAMPLE_PATHS`.
- **Seams are injected, not imported by core.** The contract stays minimal (`access`, `auditVocabulary`,
  `settingDefinitions`). What generic screens need from a domain — navigation, attention rules, follow-up
  targets, fixture seeding — lives in `src/domain/{navigation,attention,follow-ups,dev-data}.ts` and is passed
  in by the app layer and scripts. Core functions take it as a parameter (`createFollowUp(…, targets)`).
- **Core is role-agnostic.** Core code, fixtures and core tests derive roles from the access model
  (`rolesWith`, `topRoles`, `leastPrivilegedRole`); fixture users exist per declared role.
- **`templates/blank-domain`** holds a minimal, working domain (OWNER/ADMIN/STAFF, empty vocabularies,
  generic home page).
- **`npm run foundation:new-business`** renames local infrastructure per project, sets brand and legal name,
  removes `SAMPLE_PATHS` and installs the template. It refuses a dirty tree and a second run.
- **CI proves it**: the `blank-foundation` job converts a checkout and runs typecheck, lint, unit,
  integration, migration drift and E2E on the result.

## Consequences
- A new project starts from a green, domain-free baseline in minutes; the core suite keeps guarding it.
- A dental-clinic stress test was built on a converted copy without clinic-specific core changes.
- Examples of patterns are read in the foundation repository, not in the converted project.
- Adding a new generic seam means: a parameter or injected module (not a contract import), a
  template default, and the blank-foundation job staying green.
