# Business brief — template

Copy to `BUSINESS_BRIEF.md` and fill it in (Hebrew or English). Short, concrete answers beat long
ones. Write "unknown" rather than guessing — unknowns become documented decision points, not invented
rules. Examples in *italics* come from a real-estate office and a clinic.

---

## 1. Business description
- What the business does, in two or three sentences:
- Size (people using the system, records per month):
- What they use today (Excel, WhatsApp, paper, another system) and what hurts most:
- The one outcome that would make this project a success:

## 2. Users
For each kind of person: who they are, how many, how technical, where they work (office / field /
phone), and what they do in the system on a normal day.

| Person | Count | Device | Daily job in the system |
|---|---|---|---|
| *Office manager* | *1* | *desktop* | *reviews deals, closes the month, prints payroll* |

## 3. Roles
List roles in the business's own words. For each: who holds it, what they must see, what they must
never see.

| Role key (latin) | Label (Hebrew) | Holders | Sees | Must never see |
|---|---|---|---|---|
| *AGENT* | *סוכן* | *field agents* | *own deals* | *other agents' commissions* |

## 4. Permissions
Capabilities that differ between roles. Use verbs. Mark ownership rules ("own only" vs "all").

| Capability | OWNER | ADMIN | … |
|---|---|---|---|
| *See all deals* | ✓ | ✓ | own only |
| *Change a price after completion* | ✓ | — | — |

Who may manage users and reset passwords?
Who may close a period / approve a report?

## 5. Entities
The nouns. For each: fields (with type: text, money, business date, time of day, quantity, choice,
reference), which are required, who owns a record, whether it is archived or deleted when removed, and
uniqueness rules.

| Entity | Fields | Owner | Removal | Unique by |
|---|---|---|---|---|
| *Deal* | *address (text, req), amount (money, req), payment date (date)…* | *agent* | *soft delete (financial)* | *invoice number* |

## 6. Workflows
Step by step, who does what, in what order. Include what happens when something goes wrong.

1. *Agent records a deal during the month.*
2. *Office verifies the invoice…*

## 7. Calculations
Every formula, in words **and** with a worked example with real numbers. Include rounding and what
happens at thresholds ("at or above", "more than").

*Commission = 50% of the management fee before VAT; 45% after the 10th deal of the month. Example: …*

## 8. Money rules
- Currency: ILS unless stated.
- Are entered amounts before or after VAT? Which are shown to whom?
- VAT rate source (fixed / setting) and what happens to past records when it changes:
- Rounding rule (per line / per total):
- Discounts, deposits, refunds, adjustments — who may make them, is a reason required?

## 9. Lifecycle states
For each entity with a status: the states, allowed transitions, who may perform each, which need a
reason, and what each transition triggers.

| Entity | From → To | Who | Reason? | Effect |
|---|---|---|---|---|
| *Report* | *SUBMITTED → APPROVED* | *office* | *no* | *freezes figures* |

## 10. Dates
List every date that matters and what it means. Never "the date" — *which* date.
- Business dates (performed on, due, payment, appointment…):
- Periods (month of performance vs month of payment?):
- What "today" means (Israel time, working days, holidays?):
- Closing: which period gets locked, when, by whom, can it reopen?

## 11. Documents and files
Uploads needed? Which documents (contracts, invoices, photos, X-rays), types, typical size and count,
who may see them, how long they are kept. (The foundation has no file storage — this becomes a
decision point with a storage provider choice.)

## 12. Dashboard needs
What does each role need to see **first** when they open the app, to act today? (Not charts for
their own sake.)

## 13. Reports
For each report: audience, filters, columns, totals, whether it must be printable, whether it becomes
authoritative (snapshot) once approved/closed.

## 14. Exceptions / follow-up
Things that are *allowed* but need attention (missing invoice, late payment, suspected duplicate,
incomplete details). For each: how to detect it, who handles it, how it resolves.

## 15. Print
Which documents go on paper, to whom, with which header details (company name, ID, address), and
what must NOT appear on paper.

## 16. Notifications
Who must be told what, how (in-app, email, SMS, WhatsApp), and how urgently. ("None for now" is a
valid answer.)

## 17. Mobile usage
Which roles use a phone, for which tasks, in what conditions (in the car, one hand, poor reception)?

## 18. Branding and visual direction
- Product name (Hebrew / latin), and a one-line description in the business's words (or none):
- Existing brand: logo files, colours, fonts, signage, printed forms (or "none — propose"):
- Legal name, business ID, address, phone for printed documents:

**Visual direction** — short answers; this steers the design, it is not a design questionnaire.
- It should feel: *serious · warm · clinical · technical · premium · operational · editorial* (pick one or two, or your own words):
- Density: *dense (many rows, office screens)* or *spacious (few items, customers watching)*:
- Mainly used on: *desktop · phone · both* (and by whom — see §17):
- What they already look at all day that the app could echo (a ledger, a patient chart, a job board, a menu, the shop's signage):
- Products or places whose look they like (links or names; "none" is fine):
- It must definitely NOT look like: *(e.g. "a startup dashboard", "a bank", "a children's app", "our competitor X")*:

## 19. Terminology
The business's own words, so the UI never says "entity" or "record".

| Concept | Their word | Not |
|---|---|---|
| *customer* | *דייר* | *לקוח* |

## 20. Integrations
Accounting software, invoicing (e.g. Green Invoice, iCount), calendars, payment providers, imports
from Excel. Direction, frequency, and who owns the credentials.

## 21. Special rules
Anything unusual: legal requirements, privacy, retention periods, approvals, "never allow X",
historical data to import and how trustworthy it is.

## 22. Visibility and sensitive data
Who may see **which fields**, not only which records. Mark anything that would hurt someone if the
wrong colleague saw it.

| Data | Sensitive because | Who may see | Who may change | On paper / in exports? |
|---|---|---|---|---|
| *Clinical notes* | *medical* | *treating dentist, owner* | *treating dentist* | *no* |
| *Agent commission* | *salary* | *that agent, office* | *office* | *agent's own statement only* |

- Must reading a record be logged (who looked at whom)?
- ID numbers, bank details, health data, children's data stored? (Each needs a reason.)

## 23. Identifiers and external references
- Numbers people use out loud (invoice no., file no., licence plate, ID number): format, who assigns
  them, must they be sequential without gaps, can they change?
- References to other systems (accounting customer id, payment provider id): which system is the
  source of truth?

## 24. Recurring work and billing
- Anything that repeats (monthly fee, weekly cleaning, annual service): schedule, who creates each
  occurrence, what happens when one is skipped, mid-month start/stop (proration)?
- Is the app the source of truth for money owed, or does it only record what accounting issued?

## 25. Approvals
What needs someone else's approval before it counts (discount above X, refund, overtime, closing a
month)? Who approves, can they approve their own, what is frozen after approval, can it be reversed?

## 26. Existing data, imports and exports
- Data to bring in on day one (Excel, old system): volume, how trustworthy, what is missing. Unknown
  history stays empty/"legacy" — it is never invented.
- Regular imports (bank statement, price list) and exports (to the accountant, payroll): format,
  frequency, who runs them.
- Onboarding: who are the first users, who trains them, what must work on the first day?

## 27. Business calendar
Working days and hours, Friday/Saturday, holidays and חול המועד, closing dates, time slots and
durations (for appointment businesses), what happens to deadlines that fall on a closed day.

## 28. Retention and regulation
- Legal/professional obligations (bookkeeping records, medical records, privacy law database
  registration, licences): how long records must be kept, who may delete, what a customer may request.
- Anything that must never be deleted or edited after the fact.

## 29. Open questions
Things you do not know yet. They are recorded as decision points, not guessed.
