/**
 * CLOSING THE DAY — R-DAY-02 (the review time), R-DAY-04 (independent
 * answers), R-DAY-05 (the reveal), R-DAY-06 (frozen once revealed).
 *
 * Ordered: these tests are one evening told in sequence, on the one database
 * the run shares. Today is deliberately left unclosed by the fixtures, so this
 * file is what closes it.
 */

import { expect, test } from '@playwright/test';

import { copy } from '@/domain/copy';

import { apiLogin, login, watchForProblems } from '../helpers';
import { OWNER, PARTNER, setReviewTime, signOut } from './helpers';

test.describe.configure({ mode: 'serial' });

const MY_NOTE = 'הפתק הפרטי שלי ליום הזה';
const THEIR_NOTE = 'מה שהפרטנר כתב ביום הזה';

/** Today, in the timezone the product runs in. */
function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

test('before the review time the day cannot be closed, and the screen says when it can', async ({
  page,
  request,
  baseURL,
}) => {
  // 23:59 is the latest a review time can be. If the run itself is inside that
  // last minute there is no "later today" to put the review behind, which is a
  // property of the clock and not of the product.
  const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour12: false });
  test.skip(now >= '23:50', 'no future time left today to put the review behind');

  await apiLogin(request, baseURL!, OWNER);
  await setReviewTime(request, baseURL!, '23:59');

  await login(page, OWNER);
  await page.goto('/review');

  await expect(page.getByText(copy.day.notOpenYetTitle)).toBeVisible();
  // The time is set large, as a moment rather than a sentence.
  await expect(page.getByText('23:59', { exact: true })).toBeVisible();
  await expect(page.getByText(copy.day.notOpenYetWhat)).toBeVisible();
  // It answers "so what do I do now?" with the list, not with an empty screen.
  await expect(page.getByRole('link', { name: new RegExp(copy.day.backToList) })).toBeVisible();
  await expect(page.getByRole('button', { name: copy.day.submitAction })).toHaveCount(0);
});

test('one partner closes the day; the other is served a page that does not contain the answer', async ({
  page,
  request,
  baseURL,
}) => {
  await apiLogin(request, baseURL!, OWNER);
  await setReviewTime(request, baseURL!, '00:00');

  // The partner closes today with a low rating and a note.
  await apiLogin(request, baseURL!, PARTNER);
  const submitted = await request.post('/api/day-entries', {
    data: { entryDate: today(), respectRating: 2, note: THEIR_NOTE },
    headers: { Origin: baseURL! },
  });
  expect(submitted.status(), await submitted.text()).toBe(201);

  // The owner has not closed it. They are told the partner has, and no more.
  await login(page, OWNER);
  await page.goto('/review');
  await expect(page.getByText(copy.day.partnerClosedAlready('מיכל'))).toBeVisible();
  await expect(page.getByText(copy.day.revealedTitle)).toHaveCount(0);

  // The gate is structural: the note and the rating are not in the document the
  // server sent — not hidden by CSS, not in the RSC payload, not in a script.
  // R-DAY-05 is enforced by not SELECTing the partner's columns at all.
  const served = await page.request.get('/review');
  const html = await served.text();
  expect(html).not.toContain(THEIR_NOTE);
});

test('once both have closed, both answers appear together', async ({ page }) => {
  const problems = watchForProblems(page);

  await login(page, OWNER);
  await page.goto('/review');

  // Nothing is pre-selected: pressing submit with no answer says so rather than
  // sending a number nobody gave.
  await page.getByRole('button', { name: copy.day.submitAction }).click();
  await expect(page.getByRole('alert').filter({ hasText: copy.day.chooseFirst })).toBeVisible();

  await page.getByRole('radio', { name: /^4 —/ }).click();
  await page.getByLabel(copy.day.noteLabel).fill(MY_NOTE);
  await page.getByRole('button', { name: copy.day.submitAction }).click();

  // Both sides, and the sentence that compares them (4 against 2 is "far").
  await expect(page.getByText(copy.day.revealedTitle)).toBeVisible();
  await expect(page.getByText(MY_NOTE)).toBeVisible();
  await expect(page.getByText(THEIR_NOTE)).toBeVisible();
  await expect(page.getByText(copy.day.gapFar)).toBeVisible();

  problems.assertClean();
});

test('a revealed day is frozen, for both of them', async ({ page, baseURL }) => {
  await login(page, OWNER);
  await page.goto('/review');

  await expect(page.getByText(copy.day.revealedTitle)).toBeVisible();
  await expect(page.getByRole('button', { name: copy.common.save })).toHaveCount(0);
  await expect(page.getByText(copy.day.frozenNotice).first()).toBeVisible();

  // The API says the same thing as the screen.
  const amended = await page.request.patch('/api/day-entries', {
    data: { entryDate: today(), respectRating: 5 },
    headers: { Origin: baseURL! },
  });
  expect(amended.status()).toBe(422);

  await signOut(page);
  await login(page, PARTNER);
  await page.goto('/review');
  await expect(page.getByText(copy.day.revealedTitle)).toBeVisible();
  await expect(page.getByText(MY_NOTE)).toBeVisible();
});
