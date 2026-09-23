# Manual QA

Automated tests prove rules; this list catches what only a person on a real device notices. Run before
every production release that touches UI, on **one real phone** (iOS Safari or Android Chrome) and
**one desktop browser**, against a preview deployment with realistic data (`npm run qa:data -- realistic`
locally, or the preview database).

Record: date, build (Account page shows the version), device, tester, result per section.

## Sign-in and account
- [ ] Sign in with correct credentials; wrong password shows one calm message; no hint which part was wrong.
- [ ] Password manager offers to fill on sign-in and to save/generate on password change.
- [ ] Paste a password copied from WhatsApp → works.
- [ ] Temporary password flow: new user → forced change screen → cannot navigate away → sets password → lands home.
- [ ] Change own password on another device → the first device is signed out on next action.
- [ ] Sign out → back button does not show protected data after reload.
- [ ] Session expiry mid-form: press save → the form and what was typed stay; a notice offers sign-in in a new tab; after signing in there and returning, saving works.
- [ ] Slow connection (DevTools "Slow 3G"): press Enter on sign-in before the page finishes loading → no username or password appears in the address bar or history.
- [ ] Password manager fills sign-in → pressing "כניסה" signs in (no "יש למלא…" error).

## Permissions (sign in as each role)
- [ ] Navigation shows only permitted areas; typing an admin URL shows "not found".
- [ ] Staff sees only their own records in lists, search and home.
- [ ] Buttons for actions the role cannot perform are absent (and the action is refused if forced).

## Core workflows (per domain — adapt)
- [ ] Create, edit, archive, restore the main entity; audit log shows each step with actor and summary.
- [ ] Every form: submit empty → field errors in Hebrew next to fields; fix → saves; double-tap submit → one record.
- [ ] Dates: type `1/10/2026` → shows `01.10.2026`; `31.04.2026` → error; calendar picker works; stored date correct after reload.
- [ ] Money: `1,180.5` → saved as ₪1,180.50; VAT lines add up to the total to the agora; `-50` refused where refunds do not exist.
- [ ] Times (if the business has them): `9:05` → `09:05`; `25:00` → error and nothing saved; an appointment at 23:30 appears on that day's list; one booked for the day after the clock change shows the same wall-clock time.
- [ ] Sensitive fields: sign in as a role without access → the field is absent on screen, in print and in the network response (DevTools).
- [ ] Sorting: click a sortable header twice → order reverses, reload keeps it, filters stay applied.
- [ ] Lifecycle: each transition available only to the right role; reason required where it should be.
- [ ] Period close: close → figures frozen; edit affecting it refused with a clear message; reopen needs a reason.
- [ ] Attention list: fix the underlying data → item disappears; manual follow-up can be resolved.

## Mobile
- [ ] No sideways scrolling on any screen.
- [ ] Bottom navigation reachable; "עוד" sheet opens, drags down to close, Escape/backdrop close.
- [ ] Forms in sheets: keyboard does not hide the primary button; iOS does not zoom on focus.
- [ ] Tables are readable as rows; phone numbers are tappable and not reversed.
- [ ] Landscape does not break layouts.
- [ ] Typing in a full-page form on Android: the bottom tab bar is not over the field; it returns after leaving the field.
- [ ] A local production build opened on a real phone over the LAN (`http://<computer-ip>:3000`) signs in and works.

### שנינו on a real iPhone (second edition — these cannot be checked in a browser emulator)
- [ ] Today → "הוספת משימה": the sheet opens AND the keyboard comes up with it, focus in the sentence field (primeKeyboard); Enter on the keyboard adds the task; the sheet's button stays above the keyboard.
- [ ] Tap a task's circle: the circle fills with the owner's colour, the check draws, the title is struck, and after a beat the row glides down — no row jumps, the page does not scroll.
- [ ] Tap it again (reopen): it glides back up the same way.
- [ ] Complete your partner's task: the rating scale opens under the row smoothly (not a jump); one tap on a stop rates it.
- [ ] Tab bar: tap "סיכום" — the tab lights at once, even before the week appears; no skeleton flashes.
- [ ] Closing the day: the light behind the scale changes colour with the answer (cool at 1, warm at 5); nothing on the page moves when choosing.
- [ ] Reveal (a day both closed): the two circles travel in and settle overlapping; the sentence arrives after.
- [ ] Safe areas: the greeting is not under the status bar / Dynamic Island; the tab bar clears the home indicator.
- [ ] Settings → Accessibility → Reduce Motion ON: nothing travels (fills and strikes still happen).
- [ ] Dark mode (Settings → Display → Dark): every screen is plum-dark with light ink; the primary button is a pale pill.

## RTL and text
- [ ] Mixed Hebrew/English/numbers read correctly in names, notes, addresses, emails, URLs.
- [ ] Long names truncate gracefully; nothing overlaps.
- [ ] No English UI strings leaked; no raw codes (`PERIOD_CLOSED`, `null`, `undefined`) anywhere.

## Accessibility (manual pass)

**Status in the foundation:** automated axe WCAG 2.1 A/AA checks pass on core pages, the gallery and the
sample screens, and the behaviours below are implemented and partly E2E-tested (focus trap, focus return,
Escape, live regions, reduced motion). **No manual keyboard-only or screen-reader session has been
recorded yet.** Record date, device, assistive technology and tester for each item.

### Keyboard only (desktop: Chrome or Edge, no mouse)
- [ ] First Tab reaches "דילוג לתוכן"; Enter moves focus to the page content.
- [ ] Tab order follows the visual reading order in RTL (right to left, top to bottom): sidebar, page
      header actions, filters, table/list, pagination. Shift+Tab goes back the same way.
- [ ] Every interactive element shows a visible focus ring, and a focused element is never hidden under
      the sticky header (phone width) or the bottom tab bar.
- [ ] Sign-in → list → type in search → "ניקוי הסינון" → open a record from the list with Enter.
- [ ] Open a create/edit dialog with Enter: focus lands in the first field (not the close button); Tab and
      Shift+Tab stay inside; Escape closes; focus returns to the button that opened it.
- [ ] Submit with an empty required field: focus moves to that field and its error is read (see screen
      readers); editing the field removes the error.
- [ ] Destructive confirmation: "ביטול" has initial focus; Enter does not perform the destructive action
      by accident; after confirming, focus lands somewhere sensible (the page, not the top of the document).
- [ ] While saving, Escape and the backdrop do not close the dialog.
- [ ] Sortable column headers are reachable and activate with Enter; the sort direction is announced.
- [ ] Disclosure ("פרטים נוספים"): Enter/Space toggles; collapsed content is not reachable by Tab.
- [ ] Radio groups: arrow keys move between options in the visual direction (in RTL, Right arrow moves to
      the option on the right); Space selects checkboxes and switches.
- [ ] LTR fields inside the RTL form (phone, email, amount): Home/End and arrow keys move the caret the
      way the text reads; typed digits do not jump.
- [ ] Date field: the value can be typed without the calendar button (the button is skipped by Tab on
      purpose); the calendar opens with the button for pointer users.

### Phone (VoiceOver on iOS Safari, TalkBack on Android Chrome)
- [ ] Bottom tab bar items are announced with their names and the current page.
- [ ] "עוד" announces that it opens a dialog and whether it is expanded; the sheet's title is announced
      when it opens; swiping stays inside the sheet; the close action is reachable without dragging.
- [ ] A form in a bottom sheet: the primary button is reachable above the keyboard.

### Screen readers (NVDA or JAWS on Windows, VoiceOver on macOS/iOS, TalkBack)
- [ ] Page title and main heading announced after navigation (Next.js route announcer).
- [ ] Field labels read with required state; hints read after the label; errors read when the field is
      focused (linked with `aria-describedby`), and the field is announced as invalid.
- [ ] Form-level errors (`FormError`) and the session-ended notice are announced when they appear (alert).
- [ ] Success toasts are announced politely without moving focus.
- [ ] Loading: a search that refreshes the list is announced as busy; skeletons are not read as content.
- [ ] Tables: caption, column headers and sort state are announced; on phones each row reads as one item
      with its labelled parts ("טלפון: …").
- [ ] Status badges are read as words (no colour-only meaning); overdue rows say "באיחור".
- [ ] Mixed Hebrew/English/numbers (names, phones, emails, amounts) are read in the right order.
- [ ] Icons without text (close, print) have names; decorative icons are silent.

### Visual settings
- [ ] OS "reduce motion" on → sheets and dialogs fade without sliding; pages do not animate on navigation.
- [ ] Browser zoom 200% on desktop and text size "largest" on the phone: no clipped labels, no sideways
      scrolling, buttons keep their labels on one line or the row stacks.
- [ ] Windows high-contrast / forced colours: focus rings, borders and selected states remain visible.

## Print
- [ ] Each printable document: A4 preview shows business header, title, metadata, totals once, no buttons/navigation.
- [ ] Multi-page: header row repeats, rows not split.

## Errors and resilience
- [ ] Airplane mode → submit shows "no connection" message, no data loss in the form.
- [ ] Two tabs editing the same record → the second save gets "changed by someone else".
- [ ] `/api/health` returns ok.
