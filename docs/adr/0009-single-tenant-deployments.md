# 0009 — One deployment per business

Status: Accepted (2026-09-16)

## Context
The foundation builds bespoke apps for individual businesses (a real-estate office, a clinic), each with
its own rules, branding and data. Multi-tenancy adds an organization id to every row, every query and
every test, and makes one tenant's bug everyone's incident.

## Decision
Each business gets its own repository (cloned from the foundation), Vercel project and database. No
`organizationId` in the core schema. Branches/offices *within* one business are modeled in the domain
(e.g. a `Branch` entity with its own scope rule).

## Consequences
- Isolation is physical (separate databases), which is the strongest privacy boundary available.
- Improvements to the foundation are propagated to existing projects deliberately (cherry-pick or
  manual port), not automatically. Keep core changes small and documented to make that easy.
- A future multi-tenant SaaS built on this would need an ADR superseding this one.
