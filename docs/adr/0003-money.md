# 0003 — Money

Status: Accepted (2026-09-16)

## Context
Business apps compute commissions, VAT, invoices and payroll. A ledger that disagrees with itself by
one agora loses the client's trust. JavaScript numbers are IEEE doubles; `0.29 * 100 = 28.999…`.

## Decision
- Amounts are **integer minor units** (agorot) end to end: Postgres `INTEGER`, JSON numbers, TypeScript
  `Minor`. Rates are **integer basis points** (1800 = 18%).
- Multiplication by a rate uses **BigInt** and rounds **once**, half away from zero
  (`core/money/money.ts → divideRounded/applyRate`).
- User input is parsed as a string into minor units without floating point (`parseMajorInput`), strictly
  (misplaced separators, >2 decimals, signs, exponents rejected).
- VAT is explicit: `vatFromNet` (VAT rounded, gross = net + VAT) and `vatFromGross` (net rounded,
  VAT = gross − net) so parts always reconcile to what was actually charged/collected.
- The rate applied to a record is **stored on the record** (e.g. `Task.vatRateBps`). Settings supply the
  default for new records only.
- Splitting an amount uses largest-remainder allocation so parts sum exactly.
- Formatting (`₪1,180`, true minus sign, no invisible RLM characters) happens only at the edge.
- All money arithmetic lives in pure, tested functions on the server. JSX only formats.
- Decimal libraries rejected: integers are sufficient, faster, and serialize without surprises.

## Consequences
- `INTEGER` caps a single row at ±₪21,474,836.47. A domain with larger amounts switches that column to
  `BigInt` (and the TS type to bigint at that boundary).
- Currencies with 3 minor digits would need a per-currency exponent; out of scope (ILS-first).
