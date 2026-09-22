# tests

- `unit/` — pure functions, no database, parallel. `npm run test:unit`
- `integration/` — services on real PostgreSQL `bpf_test`. `npm run test:integration`
  - `support/global-setup.ts` rebuilds the schema from migrations (guarded: local, `_test` only)
  - `support/per-test.ts` truncates every table before each test (list read from `pg_tables`)
  - `support/factories.ts` users (fast scrypt params) and records via services; `caught()` for refusals
- E2E lives in `/e2e` (Playwright, production build, `bpf_e2e`). `npm run e2e`

Write authorization tests at the service layer (`authorization-matrix.test.ts` is the template) and the
HTTP-boundary versions in `e2e/api-security.spec.ts`.
