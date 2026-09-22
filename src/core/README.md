# src/core — the platform

Business-agnostic, stable. See `FOUNDATION.md §4` for the module map and `docs/adr/` for decisions.
Change only for generic needs, with tests and an ADR. Import the domain only via `@/domain/contract`.

Server-only modules (`auth/cookies`, `auth/current`, `auth/guards`, `auth/page-guards`, `db/client`,
`http/handler`, `http/idempotency`) import `server-only`; everything else is plain TypeScript usable in
scripts and tests. Services take `(client: DbClient, actor: Actor, input)` so they work inside
transactions (`inTransaction`) and in tests.
