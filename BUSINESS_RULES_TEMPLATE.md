# Business rules — template

Copy to `BUSINESS_RULES.md` at the start of a project. This is the contract between the business, the
code and the tests: every rule here has an ID, a source, and a test that proves it. When the business
changes a rule, change it here first, with the date.

Rule IDs: `R-<AREA>-<NN>` (e.g. `R-PAY-03`). Reference the ID in the service comment and the test name.

---

## 0. Sources
| Date | Source (person / meeting / document) | Topics |
|---|---|---|

## 1. Roles and permission matrix
| Capability | Permission key | Role A | Role B | Role C | Rule ID |
|---|---|---|---|---|---|
| | | | | | |

Management hierarchy (who may create/reset/disable whom):

## 2. Ownership and visibility
| Entity | Owned by | "Own" means | Who sees all | Rule ID |
|---|---|---|---|---|

## 3. Entities and invariants
For each entity: fields with type, required, allowed values, uniqueness, and invariants the database
must enforce (CHECK constraints).

### <Entity>
| Field | Type | Required | Rules |
|---|---|---|---|

Invariants:
- `R-…` 

Removal: archive / soft delete — and why.

## 4. Lifecycles
### <Entity> states
| State | Label | Meaning | Terminal |
|---|---|---|---|

| Transition | From → To | Permission | Reason required | Side effects | Rule ID |
|---|---|---|---|---|---|

## 5. Calculations
Each calculation: inputs, formula, rounding, thresholds (≥ vs >), edge cases, and **worked examples
copied into unit tests verbatim**.

### `R-CALC-01` <name>
- Inputs:
- Formula:
- Rounding: once, half away from zero, at <line/total> level
- Worked examples:

| Case | Inputs | Expected output |
|---|---|---|

## 6. Money
- Entered amounts are: net / gross
- VAT rate source and history rule:
- Adjustments: who, reason required, audit:

## 7. Dates and periods
| Date field | Meaning | Decides |
|---|---|---|

- Period definition (calendar month / other):
- Which period a record belongs to, and why:
- Close: who, when, what becomes locked, what is snapshotted (`calculationVersion`):
- Reopen: who, reason required:

## 8. Exceptions and follow-up
| ID | Condition (valid but needs attention) | Detected how | Who handles | Resolves when |
|---|---|---|---|---|

Hard validation failures (refused outright) are listed in §3 invariants, not here.

## 9. Reports and documents
| Report | Audience | Permission | Source (live / snapshot) | Printable | Rule IDs |
|---|---|---|---|---|---|

## 10. Audit
Actions that must be recorded, and which require a reason:

## 11. Settings
| Key | Meaning | Default | Range | Affects history? |
|---|---|---|---|---|

## 12. Decision points (open)
Things the brief did not settle. The implementation chose the safest generic behaviour; the business
must confirm.

| ID | Question | Current behaviour | Owner | Due |
|---|---|---|---|---|

## 13. Change log
| Date | Rule IDs | Change | Requested by |
|---|---|---|---|
