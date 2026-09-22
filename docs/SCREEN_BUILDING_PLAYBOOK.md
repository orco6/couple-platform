# Screen-building playbook

Use this for every new screen, before writing JSX. Answer the questions in a short comment at the top
of the page file (or in the PR description), build with the foundation components, then verify with
the render. Patterns referenced here are detailed in [DESIGN_PATTERN_LIBRARY.md](DESIGN_PATTERN_LIBRARY.md).

## 1. The sixteen questions

| # | Question | What a good answer looks like | Where it leads |
|---|---|---|---|
| 1 | **What is the person's primary task here?** | One verb phrase in the business's words: "לרשום תשלום שהתקבל", "לראות מי מטפל היום" | The one `primary` action, the page title |
| 2 | **What information matters most?** | The one figure, list or record they came for | What is visually dominant; top of the phone screen |
| 3 | **What is secondary?** | Context needed to act, not everything that exists | Metadata lines, `DescriptionList`, collapsed `Disclosure` |
| 4 | **Which actions are primary, secondary, destructive?** | Exactly one primary; destructive named with its consequence | `Button` variants; `ConfirmDialog` only for destructive/irreversible/reason-needed |
| 5 | **Table, list, form, sheet, dialog or full page?** | Table: ≥3 comparable columns. List: rows of one kind. Dialog: short task (≤ ~8 fields). Sheet: choose an action/option on a phone. Full page: long or multi-step work, or anything someone links to | `ResponsiveTable`, list rows, `Dialog`, `BottomSheet`, route |
| 6 | **How does it behave on a phone?** | Which columns become the row title / metadata / end / hidden; what the thumb reaches; does the role use a phone at all (brief §17) | `mobile` placement, pinned footers, tab bar destinations |
| 7 | **What happens while loading?** | Skeleton shaped like the content; actions show their own loading | `loading.tsx` + `LoadingState`, `Button loading` |
| 8 | **What happens when empty?** | Never-had-data vs filtered-empty, each with what / why / what to do | `EmptyState` (description required) |
| 9 | **What happens on error?** | Which error kinds are possible and where each shows | Error table in the pattern library §11 |
| 10 | **What happens if unauthorized?** | Out of scope → not-found; action not permitted → not offered; locked → offered as read-only with the reason | `requireActorPage`, `notFound()`, view `permissions`, lock notice |
| 11 | **Does RTL affect the layout?** | Start/end placement, chevrons, step direction, numbers alignment | Logical properties, directional icons |
| 12 | **Is any content LTR?** | Phones, emails, ids, amounts, plates, URLs, codes | `Ltr`, `MoneyText`, `DateText`, `PhoneLink`, `dir="ltr"` inputs |
| 13 | **What needs audit?** | Every write that matters; reads of private records if the business needs to know who looked | `recordAudit` in the service transaction |
| 14 | **What needs confirmation?** | Irreversible, affects others or money, closes a period, needs a reason | `ConfirmDialog` with consequence + verb |
| 15 | **What would make this look generic?** | Name the tells you are avoiding (card grid of stats, icon circles, every section boxed, four pills saying the same thing, "Welcome back") | Fix before building, not after |
| 16 | **What makes it specific to this business?** | Its nouns, its recurring object (the month, the appointment, the work order) presented the way that trade presents it, figures set the way they print them | Brief §19 terminology, §18 visual direction |

## 2. Build order

1. **Service first.** The view object carries exactly what the screen needs, including `permissions`
   flags and reasons (locked period, archived) computed from the same rules the service enforces.
2. **Page skeleton.** `PageHeader` (title, one-line context, the actions), then sections separated by
   rules and headings — not cards. One sheet per screen.
3. **Data display.** `ResponsiveTable` / list rows with mobile placement decided per column; `null` for
   missing values; server-side sort and filters in the URL.
4. **Actions.** One primary. Dialog forms with `method="post"`, `onInput={clearOnInput}`,
   `FormField name=…`, pinned footer, `dismissible={!pending}`.
5. **States.** Loading skeleton, empty (both kinds), errors per kind, read-only/locked, not-found.
6. **Copy.** The business's words; verbs on buttons; errors that say what to do; no filler.
7. **Print route** if the brief lists a document for this data.

## 3. State matrix — check every one that applies

| State | Components | Screen |
|---|---|---|
| default / hover / focus-visible / pressed | Button, links, rows, inputs | keyboard reaches everything in order |
| disabled | only with a visible reason nearby | — |
| loading | button (no flash), filters (aria-busy) | skeleton on navigation |
| success | the changed data is the feedback; toast only if off-screen | — |
| error | field, form, page (error boundary) | each error kind from §9 |
| empty | — | never-had-data and filtered-empty |
| read-only | inputs `readOnly`: dashed edge, no fill (disabled: sunken fill) | locked period / closed record says why |
| unauthorized | action absent | out-of-scope URL → not-found; API 404/403 |
| archived | — | excluded from working lists; archive screen with restore + reason |
| stale / conflict | — | 409 message with refresh |
| session ended | form kept | notice with sign-in in a new tab |

Use real content lengths while checking: the longest name, an address with apartment and floor, a
multi-line note, an empty phone, an overdue row, a negative amount (refund), a 7-figure amount.

## 4. Verify with the render

1. `npm run e2e` for the flow (happy path, one validation error, privacy by URL and API).
2. Add the screen's states to `e2e/qa/<area>.qa.ts` if the sweep cannot reach them from navigation
   (a dialog open, a locked month), using the `capture` pattern in `e2e/qa/sweep.qa.ts`.
3. `npm run qa:screenshots` → look at `screenshots/qa/desktop` and `screenshots/qa/iphone`:
   - What is dominant? Is it the answer to question 2?
   - Count the filled buttons (should be ≤ 1), the chips (only movement), the boxes (only
     document-like units), the text sizes (from the scale).
   - Does missing data read as missing, not as punctuation?
   - Does the phone show the first record without scrolling past controls?
4. Walk [../DESIGN_REVIEW.md](../DESIGN_REVIEW.md). Run the Hallmark `audit` verb (required; pinned install in DESIGN_REVIEW.md)
   (read-only punch list). Record intentional divergences with a reason.
5. `e2e/<area>/accessibility.spec.ts` (axe) green.

## 5. Copy rules for screens

- Operational and direct. Say what the thing is and what to do.
- Banned filler: "ברוכים הבאים", "Welcome back", "כל מה שצריך במקום אחד", "Manage your workflow",
  "Unlock insights", "בקלות ובמהירות", exclamation marks, emoji as icons.
- Titles are nouns of the business ("תשלומים", "תורים להיום"); buttons are verb + object ("רישום
  תשלום"); empty states say what / why / what to do; errors say what happened and the next step.
- Neutral grammatical forms where Hebrew allows (the core copy does this); do not assume gender.
- Numbers: "3 תורים", not "שלושה תורים"; "₪1,180", not "1180 ש״ח" unless the business writes it so.
