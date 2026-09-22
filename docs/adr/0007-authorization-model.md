# 0007 — Authorization model

Status: Accepted (2026-09-16)

## Context
Every business has different roles, but the failures are always the same: role-name checks scattered in
code, UI-only restrictions, list endpoints returning everything, 403 responses that confirm a record
exists, hidden form fields trusted by the server, and admins able to promote themselves.

## Decision
- **Permissions** (`area.capability`) are what code checks. **Roles** are bundles defined per business
  (`domain/access.ts`), stored as strings on User. Core defines platform permissions (users, audit,
  settings, archive, follow-ups, periods).
- **Escalation rule**: an actor may manage/assign a role only if that role's permission set is a subset
  of the actor's. No separate "rank" to maintain.
- **Structural scoping**: services AND a scope into every query (`scopeWhere` / `<entity>Scope(actor)`).
  Out of scope ≡ nonexistent → 404.
- **Field-level authority** checked in services; request schemas are strict.
- Page guards and navigation filtering exist for UX; services re-check everything.
- Organization/tenant scope is not modeled (ADR 0009).
- Row-level security in Postgres considered and deferred: it duplicates rules in SQL, complicates
  pooling and migrations, and the service layer with tests is sufficient for single-business apps.
  Revisit for apps with untrusted SQL access or many services.

## Consequences
- Each entity needs a scope function and an authorization matrix test (template in the sample).
- Permission changes need no migration; tests must be updated.
