# Stress tests of the foundation

Two businesses deliberately unlike the sample, used to find what the foundation gets wrong. Neither is a
product: the clinic was built in a throwaway copy and deleted; the garage was worked through on paper
against the code.

## 1. Dental clinic (built, 2026-09-16)

**Setup.** Fresh clone → `npm run foundation:new-business -- --name "מרפאת שיניים גבעון" --slug clinic-spike
--db-port 5435` → blank foundation green → clinic domain.

**Scope built.** Roles OWNER / RECEPTIONIST / DENTIST. Patient, Appointment (instant + duration, lifecycle
SCHEDULED → ARRIVED → COMPLETED / CANCELLED with reason / NO_SHOW), Treatment (performed-on date, price,
clinical notes, soft delete with reason), Payment (signed agorot for refunds, void with reason, never
deleted). Screens: today's appointments (home), patient list with search, patient detail with
appointments / treatments / payments / balance and booking, treatment and payment dialogs, print summary.
Audit: every write, plus `patient.viewed`.

**Rules that stressed the core.**
- Privacy through a relation: a dentist reaches a patient only through their own appointments or
  treatments (`scopeWhere` with an `OR` of relation filters). Another dentist gets not-found on the page,
  the print page and the API.
- Field-level **read**: clinical notes are omitted from views for reception; never copied into audit.
- Appointment times in Israel time across the DST change; a 23:30 appointment belongs to its local day.
- A receptionist cannot document treatments; a dentist cannot see payments or book; the treating dentist
  comes from the session.

**Results.** Clinic domain services, seams and screens ≈ 1,070 lines, schema ≈ 110, tests ≈ 190. Clinic tests: 10 integration, 2 E2E flows, axe on
the clinic screens and the booking dialog. With the unchanged core suites, final run on the current core: typecheck,
lint, unit 130, integration 54 + 1 skipped (escalation test; the clinic has one user-manager level), build, E2E 41 +
2 skipped (desktop-/mobile-only tests) — all green. Mutation checks: removing the dentist's
relation scope and exposing clinical notes each failed a clinic test.

**Core changes needed: none clinic-specific.** Generic gaps found and fixed in core, with tests:

| Gap | Fix |
|---|---|
| No way to query "all appointments on this local day" safely on 23/25-hour days | `localDayRange` |
| No time-of-day input; native `type=time` shows AM/PM on English machines | `TimeInput` |
| API accepted `9:00` while dates are strict | `fields.localTime` exactly HH:MM |
| `TimeInput` kept the previous valid time while the screen showed `25:00` | reports `''`, `aria-invalid` |
| `MoneyInput` turned `-5` into 5 where negatives are not allowed | minus is invalid input, never stripped |
| Printed documents showed the template's placeholder company details | script sets legal name, clears placeholders; empty fields omitted |
| `migrate dev` left the Prisma client stale (new models "missing") | db scripts regenerate the client |
| A follow-up could be assigned to someone who cannot see the record, leaking its note | assignee must reach the record |
| Page 404s stream with HTTP 200 | documented; E2E asserts page privacy by content |

## 2. Garage (thought experiment against the code)

Roles OWNER / SERVICE_ADVISOR / MECHANIC. Customer, Vehicle, WorkOrder, Part, Payment.

| Need | Foundation answer | Verdict |
|---|---|---|
| Mechanic sees only work orders assigned to them | `scopeWhere(actor, { all: 'work_orders.read_all', own: { mechanicId: actor.id } })` | fits |
| Work order states incl. waiting for parts, customer approval of a quote | `defineLifecycle`; approval by phone is a transition by the advisor with a required reason | fits |
| Licence plate unique, typed in many formats | domain normalisation + unique index; `fields.text` + regex | fits (domain) |
| Vehicle changes owner; history stays with the vehicle | Vehicle separate from Customer; WorkOrder stores the customer at the time | fits (domain model) |
| Parts stock decremented by concurrent work orders | `updateMany({ where: { id, quantity: { gte: n } } })` + count check, audited | fits (domain pattern) |
| 1.5 litres of oil, 45 minutes of labour | integer thousandths / minutes + `prorate` | fits |
| VAT per line, totals exact to the agora | `core/money` VAT + `allocate` | fits |
| Partial payments, refunds | signed payments as in the clinic | fits |
| Drop-off times, opening hours | `TimeInput` + `localToInstant`; opening hours are domain settings | fits |
| Printed quote / invoice copy | `PrintLayout` + brand legal identity | fits |
| Photos of damage | **no file storage** | known limitation (also the clinic's X-rays) |
| SMS "your car is ready" | **no notifications** | known limitation |
| Official tax invoices | external invoicing provider integration | decision point per business |
| Mechanic on a phone with dirty hands | mobile shell, 44px targets, bottom sheets | fits; verify in design review |

**Did the core become medical?** No. `src/core` contains no clinic vocabulary (checked by search; the
only examples in comments were neutralised), no clinic role names, and every core addition above is used
equally by the garage analysis.

**What would come next in core.** File storage (needed by both) and outbound notifications are the two
capabilities that repeat across businesses. Neither was added: each needs a provider decision and an ADR,
and adding them untested for a hypothetical business would violate "no complexity without proven value".
