# 0005 — Dates and time

Status: Accepted (2026-09-16)

## Context
Israeli businesses write DD.MM.YYYY. Native `<input type="date">` segments follow the browser locale
(MM/DD on English Windows). `new Date(2026, 3, 31)` silently becomes 1 May. Vercel functions run in UTC,
so "today" and displayed times are wrong for three hours a night if computed in server-local time.
Koma separated performance month, payment month and payment date after learning they differ.

## Decision
- Two kinds of time:
  - **CalendarDate** (`"YYYY-MM-DD"`, branded string) for business days — due, performed, payment.
    Stored `@db.Date`, read with UTC getters only.
  - **Instant** (`Date`/ISO) for events — createdAt, occurredAt, lastLoginAt — always *displayed* in the
    business timezone (`Asia/Jerusalem`, `brand/brand.ts`).
- **Local wall-clock times** (appointments, shifts) are a CalendarDate + `LocalTime` ("HH:MM") converted
  to an instant with `localToInstant`: times inside the spring-forward gap are rejected, the repeated
  autumn hour resolves to the earlier instant and `isAmbiguousLocalTime` lets a form warn.
- **Periods** are `(year, month)` pairs, not dates.
- Parsing is strict: day first, four-digit year, round-trip validated; invalid input is rejected, never
  corrected. ISO input from APIs validated the same way.
- "Today" = `todayIn(businessTimeZone)`; future-date rules use it.
- `DateInput`: text field with fixed order + native picker popup via `showPicker()` as a convenience.
- Formatting is composed by hand (not `Intl` date styles), so an ICU update cannot reorder a date.
- `createdAt` is never used as a business date; entities get explicit date fields.

## Consequences
- Every business date field states its meaning in the schema comment and BUSINESS_RULES.md.
- Multi-timezone businesses would need a per-user timezone; out of scope.
