# 0010 — Testing strategy

Status: Accepted (2026-09-16)

## Context
Koma lessons: global state (settings, bonus rules) leaked between tests and made results
order-dependent; SQLite locally hid Postgres behaviour; hand-maintained table cleanup lists forgot new
tables; E2E on `next dev` was slow and flaky.

## Decision
- **Unit** (`tests/unit`, Vitest, parallel): pure functions — money, dates, lifecycle, access, policy,
  guards, validation, calculations. Worked examples from the business go here verbatim.
- **Integration** (`tests/integration`, Vitest, sequential): services against real PostgreSQL
  (`*_test`). Global setup replays migrations from empty; **every test** starts from truncated tables,
  with the table list read from `pg_tables`. No in-memory caches anywhere in services. Authorization is
  tested at the service layer, where the boundary is.
- **E2E** (`e2e/`, Playwright): a production build against `*_e2e` seeded through the services;
  desktop + mobile projects; security checks at the HTTP boundary (direct URLs, manual API calls,
  altered ids, cross-origin); assertions retry instead of arbitrary waits.
- Layout: `tests/*/core` and `e2e/core` are role-agnostic platform tests; `tests/*/<area>` and `e2e/<area>` belong to
  the domain. Structural tests guard every future domain (`request-schemas-strict.test.ts`).
- Tests are mutation-checked when written for critical controls (break the control, confirm failure).
  Review 2026-09-16: scope filter, permission check, `.strict()`, audit trigger, date rollover, closed period,
  idempotency fingerprint, HTTPS session cookie, same-origin check, follow-up assignee reach — all fail at least
  one test. `.strict()` initially survived; the structural test was added for it.
- Order independence is verified with `--sequence.shuffle` on several seeds and repeated integration runs.
- CI runs everything, including a migration drift check and the blank-foundation conversion.

## Consequences
- Integration tests are slower than mocks (~15 s) but test the real thing.
- E2E specs share one database per run; they create uniquely named data and do not depend on order,
  except fixtures that are consumed once per run (e.g. the forced password change user), which run only
  in the desktop project.

## Flaky tests (policy, 2026-09-17)

- A test that failed once is investigated to a cause. Retries never count as a fix: CI keeps one retry only
  to capture a second trace, and `failOnFlakyTests` fails the run when a test passes only on retry.
- Evidence is kept: traces and screenshots on failure always; `E2E_DIAGNOSE=1` adds videos and the server's
  own log lines; CI uploads `playwright-report/` and `test-results/` for both E2E jobs on failure.
- Wait for the condition, not for time. Arbitrary `waitForTimeout` is allowed only in the screenshot sweep
  (letting animations settle for a picture), never in a test's assertions.

### Investigation record
- **Original report:** one failure of the sample customer workflow in a full run right after a fresh build;
  artefacts were overwritten. Since then: 12 full-suite runs with diagnostics, 6 targeted repeats — not
  reproduced. Hypotheses tested and rejected with evidence: (1) `router.push()` followed by `router.refresh()`
  cancelling the navigation and Next.js logging "Failed to fetch RSC payload" as a console error — 0 in 35
  real archives, 20 of them at 6× CPU throttling; (2) cold-server timeout — the test takes 8.4s of its 45s
  budget. Cause of that single failure: **unknown**; the evidence-keeping above exists so the next
  occurrence is diagnosable.
- **Found and fixed during the investigation:** a real intermittent failure (1 of 8 full runs) in the sample
  accessibility spec: axe reported `document-title` on a page reached by client navigation. A per-frame
  probe showed `document.title` empty for 1–3 frames in 4 of 15 navigations while Next.js swaps the streamed
  title. The specs now wait for a non-empty title (the real condition); detail pages now set the record's
  name as the title. 15 of 15 repeats passed afterwards.
- **Also found:** mid-investigation, new regression tests failed against the previous build — correct
  failures (the fixes were not built yet), not flakes; the loop was restarted on a frozen tree.
