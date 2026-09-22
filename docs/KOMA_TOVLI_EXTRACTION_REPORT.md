# Koma / Tovli extraction report

**Purpose.** Future agents building on this foundation will not have the Koma or Tovli repositories.
This report records what was inspected in them (read-only, September 2026), what was learned, what the
foundation adopted or rejected, and why — so the lessons survive without the sources. The actionable
form of the adopted patterns is [DESIGN_PATTERN_LIBRARY.md](DESIGN_PATTERN_LIBRARY.md); this document
is the provenance and the reasoning.

Neither repository was modified. Both were at the same commits before and after (Koma `d8264a6`,
Tovli `4a862a1`).

---

## 1. The two products

| | Koma (`baks`) | Tovli (`shayandor`) |
|---|---|---|
| What | Internal monthly-ledger tool for a real-estate office: agents record rentals, the office checks invoices, commissions are paid | Consumer second-hand ticket/voucher marketplace (Hebrew) |
| Users | ~10 office staff and agents, desktop and phone | Public consumers, phone first |
| Stack | Next.js 15, React 19, Tailwind 4, `motion`, Prisma, Neon | Expo 54 / React Native 0.81 app (`@gorhom/bottom-sheet`, Reanimated 4, gesture handler, keyboard controller, React Navigation), Vite + React web admin, Firebase functions, marketing site |
| Closest to this foundation | Very close: same kind of operational business tool | Mobile interaction craft; different medium (native) |
| Most valuable artefact | `DESIGN.md` and `IDENTITY.md`: design decisions with measurements, and bugs found by looking at renders | Interaction timing and mobile behaviour in component code |

## 2. Areas inspected

### Koma
- Documents: `DESIGN.md` (thesis, tally, type, colour, RTL, mobile, motion, print, what was taken from
  Tovli), `IDENTITY.md` (the "generated look" diagnosis, measured type/colour audits, ledger concept,
  second pass), `skills-lock.json` (only Neon skills; no design skills installed).
- UI primitives: `components/ui/Button.tsx`, `Sheet.tsx`, `Field.tsx`, `useValidatedField.ts`,
  `Toast.tsx`, `ConfirmDialog.tsx`, `Display.tsx` (status chips, page header, collapsible section,
  column header, empty state, skeletons, notices), `PasswordField.tsx`, `MonthSelector.tsx`.
- Navigation: `components/nav/TopBar.tsx`, `navItems.ts`, `ViewTransition.tsx`.
- Screens and flows: `report/EntryList.tsx` (design notes), `admin/UsersBoard.tsx`,
  `admin/MonthCloseControl.tsx`, `app/login/LoginForm.tsx`, `app/change-password/FirstRunPasswordForm.tsx`,
  `app/error.tsx`, `lib/client/request.ts` (session expiry handling), `app/globals.css` (tokens, focus,
  rules, keyframes).
- Tooling: `tools/capture.mjs` (screenshot harness), `tools/motion-probe.mjs` (per-frame animation sampling).
- **Not inspected in depth:** server/business logic (commission calculation, invoices), charts
  (`TrendChart`), payroll and adjustments screens beyond headers, print pages beyond the design notes.

### Tovli
- `AI_WORK_GUIDELINES.md` (team rules for AI assistants), app `package.json` (libraries).
- Components: `AppAlert.tsx` (alert queue, modal settle timing), `OptionsBottomSheet.tsx` (action sheet,
  close-then-act), `ProfileNameEditSheet.tsx` (form in a sheet: validation timing, save lock, keyboard,
  success sheet). Component and screen inventory (names and sizes of ~40 components and ~35 screens).
- Utilities and contexts: `utils/tabBarLayout.ts`, `utils/rtlIcon.ts`, `contexts/TabBarVisibilityContext.tsx`,
  `contexts/LoaderContext.tsx`, `utils/loaderUtils.ts`; keyboard handling usage across screens
  (`KeyboardAwareScrollView`, `KeyboardAvoidingView`).
- Web admin: `admin/src/pages/UsersPage.tsx` (master–detail browsing), admin auth context.
- Secondhand (from Koma's documented audit of Tovli, not re-measured here): palette in `utils/colors.ts`,
  separator counts (`borderBottomWidth` hairlines far outnumber boxed surfaces), `FeedPostCard` unboxed
  rows vs `ChatListItem` cards, type scale topping out at 20–22px with weight 600 dominant, 8px default gap,
  `LoginScreen` error text colour, sheet spring/timing values, default 200ms durations.
- **Not inspected:** marketplace screens in detail (`AddItemScreen`, `SearchScreen`, chat), Firebase
  functions and rules, marketing site, payment/verification flows.

## 3. Patterns adopted (and where they live now)

### Interaction and components
| Pattern | From | Why | Foundation |
|---|---|---|---|
| Press lands in 40ms, releases in 200ms | Koma Button (Tovli Pressable) | A symmetric transition never reaches its pressed state in a real tap | `button-styles.ts` |
| Loading keeps button width; spinner only after 150ms | Koma Button (+ Hallmark "spinners that flash") | No layout shift mid-click; fast saves do not flash | `Button`, `.spinner-delayed` |
| One committing (filled) action per view | Koma button system | Fill means "this writes"; otherwise no hierarchy | pattern library §1 |
| Submit never disabled for invalid input; pressing reveals problems and focuses the first | Koma LoginForm (Tovli forms) | A disabled button that will not say why wastes time | `useSubmit` |
| Errors appear late and leave immediately (Tovli: after blur, 800ms; clear at once) | Tovli ProfileCompletion, Koma useValidatedField | Not nagging while typing; instant relief when fixed | server errors clear on edit: `clearOnInput` |
| Values filled without events (autofill, pre-hydration typing) | Koma useAdoptExistingValue | Filled-looking fields rejected as empty | `form-values.ts` |
| One overlay: bottom sheet on phones, dialog on desktop | Koma Sheet, Tovli sheets | Physical metaphor per device | `Dialog presentation="auto"` |
| Asymmetric overlay motion (soft in, decisive out), transform-only sheet | Tovli sheets, Koma measurements (fade halved frame rate) | Feels considered, stays smooth | motion tokens |
| Close, then act (run the next action after the sheet closed) | Tovli OptionsBottomSheet, AppAlert settle | Two overlays animating together looks broken | `onExited` |
| Save lock: a sheet cannot be dismissed while saving | Tovli isSavingRef | Half-written state | `dismissible={!pending}` |
| Confirmation names consequences; verb on the button; cancel first | Koma ConfirmDialog / UsersBoard (Tovli AppAlert layout) | "Remove" read as "erase" | `ConfirmDialog` |
| Toasts polite, never steal focus, exit animated | Koma Toast | Keep the user's place | `Toast` |
| Collapsible sections animate and are real buttons with aria-expanded | Koma CollapsibleSection | Accessible and not abrupt | `Disclosure` |

### Visual
| Pattern | From | Foundation |
|---|---|---|
| Rules and hairlines instead of boxing everything; box only discrete objects | Tovli (via Koma audit), Koma IDENTITY | surfaces, `divide-rule-faint`, sections without cards |
| Hierarchy from weight, modest type scale, no 40px KPI numbers | Tovli (via Koma audit), Koma second pass | type scale; brand title size/weight tokens |
| Quiet ordinary states; chips only for states that moved | Koma StatusChip | `StatusBadge` |
| Empty state as instruction; no icon circle | Koma EmptyState | `EmptyState` (description required) |
| Red only for what is wrong; expected waits are amber or text | Koma colour notes | error table, `Notice tone="warning"` |
| Radius by kind (documents square, controls soft, sheets round) | Koma IDENTITY | brand radius tokens |
| Chrome can be the desk (canvas), documents the only white | Koma TopBar | `--brand-chrome` |
| Tabular figures; LTR isolation for Latin/numbers; logical properties | Koma DESIGN | `tnum`, `Ltr`, `MoneyText` |
| No letter-spacing / uppercase on Hebrew; body leading ≥1.6 | Koma globals.css | `foundation.css` |

### Mobile
| Pattern | From | Foundation |
|---|---|---|
| Tab bar steps aside while typing | Tovli TabBarVisibilityContext | CSS `:has()` on `[data-mobile-tab-bar]` |
| Content reserves the tab bar height; safe-area padding with an Android minimum | Tovli tabBarLayout | `pb-28`, `pb-safe`, scroll padding |
| Actions pinned above the keyboard | Tovli keyboard controller, Koma sheet footer | Dialog footer |
| Two presentations of dense data (table ≥ md, rows on phones) | Koma EntryList | `ResponsiveTable` |
| 16px controls (no iOS zoom), 44px targets, `inputMode="decimal"` not `type=number` | Koma DESIGN | Field, MoneyInput |
| Test on WebKit iPhone, not resized Chromium | Koma (caught a Secure-cookie bug) | `npm run qa:screenshots` (caught a CSP bug here) |
| Directional icons mirror, object icons do not | Tovli rtlIcon | `Icon directional` |
| Time steps follow reading direction | Koma MonthSelector | sample stepper, pagination |

### Security-sensitive UX
| Pattern | From | Foundation |
|---|---|---|
| Deactivate, never delete users; say what stays; cannot deactivate yourself; "this is me" marker | Koma UsersBoard | users board, `manageable` flag |
| Reopening a closed month requires a reason; closing warns but does not block | Koma MonthCloseControl | period controls |
| Error boundary shows words, never digests or stacks | Koma error.tsx | `error.tsx` |
| First-run password: navigate + refresh so server guards re-evaluate | Koma FirstRunPasswordForm | `navigateAfterSessionChange` (full navigation) |
| Session expiry: both apps redirect to sign-in (losing input) | Koma request.ts | **improved on**: `SessionNotice` keeps the form |

### Process
| Pattern | From | Foundation |
|---|---|---|
| Capture harness at desktop + iPhone before judging design | Koma tools/capture.mjs | `e2e/qa/sweep.qa.ts` |
| Measure animations per frame instead of trusting source numbers | Koma tools/motion-probe.mjs | documented (pattern library §16) |
| Diagnose "generated look" by measuring sizes, weights, colours on the render | Koma IDENTITY | screen playbook §4, pattern library §20 |
| Record design decisions with the evidence and the bug that forced them | Koma DESIGN/IDENTITY | this report, the library's extraction record |

## 4. Patterns rejected, and why

| Pattern | From | Reason |
|---|---|---|
| App-wide blocking loader modal ("טוען...") | Tovli LoaderContext | Blocks every interaction for one request; business tools use per-control loading and skeletons |
| Staggered row entrance animation (28ms per row) | Tovli admin | Makes people wait for data that already arrived; decorative motion |
| Global alert queue with iOS 450ms / Android 120ms modal-settle timers | Tovli AppAlert | Works around React Native modal limitations; the web `<dialog>` stacks correctly and `onExited` covers sequencing |
| Separate success bottom sheet after a save | Tovli ProfileNameEditSheet | Consumer celebration; in operational tools the changed data (or a toast for off-screen effects) is the confirmation |
| Green valid-state check inside every field | Tovli, Koma Field | Noise on forms filled dozens of times a day; kept as a domain choice for consumer-facing sign-up |
| Validating every keystroke on the client with an 800ms display debounce | Tovli, Koma | The foundation validates on the server (single source of truth); the transferable part (errors leave immediately) was adopted |
| `motion` library | Koma | CSS transitions + native `<dialog>` cover every use at lower cost (ADR 0008) |
| Travelling nav indicator (`layoutId`) | Koma TopBar | Needs a motion library; the static active state is clear |
| Start-edge coloured state rule on rows | Koma ledger | Conflicts with Hallmark/Impeccable side-stripe tell; documentation only, for dense ledgers with one exception kind, never on cards |
| Search submitted with an explicit button | Tovli admin | URL-state debounced search is faster for operational lists |
| Hardcoded mock data helpers and duplicated screens (`MarketplaceScreenOld.tsx`, `.backup` files) | Tovli | Not patterns — cleanup debt |

## 5. Product-specific patterns intentionally excluded

**Koma-specific** (belong to a commission ledger, not a foundation): the bookkeeper's **tally** with a
double rule for the payable figure; the **period as page number** (month set large above an accent rule
on every screen); the deep petrol brand and sign-in field; commission deferral wording ("לתשלום
בספטמבר"); duplicate-deal cards; agent-vs-admin two-question framing; Frank Ruhl Libre (Koma itself later
replaced it with Rubik).
*What generalised instead:* "find the business's recurring object and give it one consistent visual
treatment" (brief §18, library §20).

**Tovli-specific** (belong to a consumer marketplace or to React Native): the teal `#00A896` identity,
Rubik as the brand face, the folded-paper motif; feed and chat layouts; favourites notification; phone
verification gate; PDF viewer; haptics (`expo-haptics`); pull-to-refresh control; image-heavy post cards;
platform-specific keyboard and modal workarounds.
*What generalised instead:* interaction timing, sheet behaviour, keyboard-safe actions, tab-bar handling,
selective boxing.

## 6. What the extraction exposed in the foundation (fixed, with tests)

Comparing the two products against the foundation surfaced defects that neither reference had fixed:
GET-submitting forms before hydration leaking passwords into URLs; autofilled credentials rejected;
typed input lost on session expiry; `TimeInput`, `MoneyInput` and `DateInput` holding values different
from what was on screen; the CSP breaking hydration on WebKit over plain http; server field errors
staying after the field was fixed; a sample month stepper contradicting core pagination; capability
flags offering actions a closed month forbids; no way to clear filters from a filtered-empty list; the
search field not following the URL. Details: library §0 and the git history of September 2026.
