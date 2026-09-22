# 0001 — Core / domain / brand split

Status: Accepted (2026-09-16)

## Context
The foundation is cloned for many different businesses and modified by AI agents from a short brief.
Koma (the reference application) mixed reusable infrastructure (sessions, audit, money) with
real-estate rules in the same `lib/` and `server/` folders, so extracting one meant understanding both.
A generic configuration engine (entities in JSON, workflow builder) was rejected: it trades bespoke
quality for flexibility nobody needs in a single-business app.

## Decision
- `src/core/` holds business-agnostic platform code. `src/domain/` holds everything specific to one
  business. `src/brand/` holds identity (name, locale, tokens, logo).
- Core reaches the domain only through `src/domain/contract.ts` (access, audit vocabulary, settings),
  enforced by ESLint `no-restricted-imports`.
- Core APIs are functions taking `(client, actor, input)`; the domain composes them. No plugin system,
  no registries beyond the contract, no runtime configuration of entities.
- The Prisma schema is split into `core.prisma` (with one marked block of domain back-relations, which
  Prisma requires) and `domain.prisma`. Migrations likewise: `core_platform` and `sample_domain`.
- A small sample domain proves the core end to end and is deleted for real projects.

## Consequences
- A new project changes domain + brand and should not touch core; the prompt forbids casual core edits.
- The contract is a compile-time dependency from core to domain; replacing the domain means keeping
  the contract's export names.
- Some duplication in domain code (scope functions, view mappers) is accepted in exchange for
  explicit, readable services an agent can follow.
