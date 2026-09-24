/**
 * The deployed review environment, checked the way a reviewer will use it.
 *
 * Scope is deliberately narrow: this is not the E2E suite (CI already ran it
 * against the same commit). It answers one question — does the real product,
 * on the real database, behind the real proxy, work on a phone?
 *
 * It writes only its own rows and deletes its tasks when done, and it does not spend the demo: today is left
 * unclosed so the reviewer can close it themselves, and the reveal is checked
 * on a day the fixtures already revealed.
 */

import { expect, test, type Page } from '@playwright/test';

import { copy } from '@/domain/copy';

const A = 'review-partner-a';
const B = 'review-partner-b';

const PASSWORD_A = process.env.REVIEW_PASSWORD_A ?? '';
const PASSWORD_B = process.env.REVIEW_PASSWORD_B ?? '';

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

function daysAgo(n: number): string {
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

/** Console errors, uncaught exceptions and failed application requests. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // A 4xx on an API call is the product refusing something on purpose; the
    // specs below assert those outcomes directly. 5xx is caught separately.
    if (/status of 4\d\d/.test(text)) return;
    problems.push(`console: ${text.slice(0, 200)}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message.slice(0, 200)}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
    if (response.status() === 404 && new URL(response.url()).pathname.startsWith('/api/')) {
      problems.push(`404 ${response.url()}`);
    }
  });
  return { assertClean: () => expect(problems, problems.join('\n')).toEqual([]) };
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('שם משתמש').fill(username);
  await page.getByLabel('סיסמה', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'עוד', exact: true }).click();
  await page.getByTestId('mobile-more-sheet').getByRole('button', { name: 'יציאה' }).click();
  await page.waitForURL(/\/login/);
}

function card(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title });
}

/** Adds a task through the sheet and returns its title. */
async function addTask(page: Page, title: string, owner: 'me' | 'partner') {
  await page.goto('/');
  await page.getByRole('button', { name: copy.tasks.addAction }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(copy.tasks.titleLabel).fill(title);
  await sheet.getByRole('group', { name: copy.tasks.ownerLabel }).locator('label').nth(owner === 'me' ? 0 : 1).click();
  await sheet.getByRole('button', { name: copy.common.add }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  return title;
}

test.beforeAll(() => {
  expect(PASSWORD_A, 'REVIEW_PASSWORD_A is required').not.toBe('');
  expect(PASSWORD_B, 'REVIEW_PASSWORD_B is required').not.toBe('');
});

test('the deployment answers and serves its own security headers', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe('ok');

  const page = await request.get('/login');
  expect(page.status()).toBe(200);
  const headers = page.headers();
  expect(headers['content-security-policy'], 'CSP is served').toMatch(/script-src[^;]*'nonce-/);
  expect(headers['x-frame-options']).toBe('DENY');
  // HSTS is only sent over HTTPS, which is the only way the deployment is
  // reached; a local dry-run of this file over http has nothing to assert.
  if (page.url().startsWith('https://')) {
    expect(headers['strict-transport-security'], 'HSTS').toBeTruthy();
  }
});

test('both partners sign in, and the list is genuinely shared', async ({ page }) => {
  const problems = watch(page);
  const stamp = Date.now().toString(36).slice(-4);

  // ── Partner A ──────────────────────────────────────────────────────────
  await signIn(page, A, PASSWORD_A);
  await expect(page.getByRole('heading', { name: copy.today.listTitle })).toBeVisible();

  // A task A owns: A finishes it and is told they are waiting. No rating
  // offered to the person whose task it is.
  const mine = await addTask(page, `בדיקה ${stamp} — שלי`, 'me');
  await card(page, mine).getByRole('button', { name: copy.tasks.completeAction }).click();
  await expect(card(page, mine).getByText(copy.taskRating.awaitingShort, { exact: false })).toBeVisible();
  await expect(card(page, mine).getByRole('button', { name: copy.taskRating.prompt })).toHaveCount(0);

  // A task B owns: A finishes it, and A may rate it.
  const theirs = await addTask(page, `בדיקה ${stamp} — של הפרטנר`, 'partner');
  await card(page, theirs).getByRole('button', { name: copy.tasks.completeAction }).click();
  // The rating is optimistic and queued behind the completion; reloading
  // before its request leaves would abort it (seen on the deployment).
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/task-ratings') && r.request().method() === 'POST');
  await card(page, theirs).getByRole('button', { name: copy.taskRating.prompt }).click();
  const sheet = page.getByTestId('rate-sheet');
  const slider = sheet.getByRole('slider');
  await slider.fill('4');
  await expect(slider).toHaveAttribute('aria-valuetext', /^4 —/);
  await slider.press('Enter');
  expect((await saved).ok()).toBe(true);
  await expect(sheet).toBeHidden();

  // The write survived the round trip, not just the optimistic render.
  // After a reload the rated row is folded to one line that says what was given.
  await page.reload();
  await expect(card(page, theirs).getByText(copy.taskRating.myRatedLine(copy.taskRating.scale[4]))).toBeVisible();

  // ── Partner B ──────────────────────────────────────────────────────────
  await signOut(page);
  await signIn(page, B, PASSWORD_B);
  await page.goto('/');

  // B sees A's list, and may rate the task A owns — which A could not.
  await card(page, mine).getByRole('button', { name: copy.taskRating.prompt }).click();
  await slider.fill('5');
  await expect(slider).toHaveAttribute('aria-valuetext', /^5 —/);
  await slider.press('Enter');
  await expect(sheet).toBeHidden();

  // The review environment is where the couple actually lives: leave nothing
  // behind. Deleted the way a person deletes (the task screen, then confirm).
  for (const title of [mine, theirs]) {
    await card(page, title).getByRole('button', { name: title }).click();
    await page.getByTestId('composer').getByRole('button', { name: copy.tasks.deleteAction }).click();
    await page.getByRole('dialog').getByRole('button', { name: copy.tasks.deleteShort, exact: true }).click();
    await expect(card(page, title)).toHaveCount(0);
  }

  problems.assertClean();
});

test('the day closes, waits, and reveals', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, A, PASSWORD_A);

  // A day neither of them closed, so this can run at any hour and does not
  // spend today — the reviewer closes today themselves.
  await page.goto(`/review?date=${daysAgo(5)}`);
  const submit = page.getByRole('button', { name: copy.day.submitAction });
  const waiting = page.getByText(copy.day.waitingTitle('נטיה'));
  // A second run the same day finds this day already closed by the first:
  // the waiting state is then the whole assertion (deploy:preview re-runs it).
  await expect(submit.or(waiting)).toBeVisible();
  if (await submit.isVisible()) {
    await page.getByRole('slider', { name: copy.day.respectLabel }).fill('4');
    await submit.click();
  }
  await expect(waiting).toBeVisible();

  // A day both of them closed: both answers, and no way back. The review data
  // can be emptied on purpose (deploy:preview -- --clear-data), and then no
  // such day exists yet — that is noted, not failed.
  await page.goto(`/review?date=${daysAgo(2)}`);
  await page.waitForLoadState('networkidle');
  const revealed = page.getByText(copy.day.revealedTitle);
  if (await revealed.isVisible()) {
    await expect(page.getByRole('button', { name: copy.common.save })).toHaveCount(0);
  } else {
    test.info().annotations.push({ type: 'note', description: 'no day closed by both yet (empty review data)' });
  }

  problems.assertClean();
});

test('the summaries load and the phone bar reaches every screen', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, A, PASSWORD_A);

  const bar = page.locator('[data-mobile-tab-bar]');
  await expect(bar).toBeVisible();

  await bar.getByRole('link', { name: copy.nav.reflection }).click();
  await page.waitForURL(/\/week$/);
  await expect(page.getByRole('heading', { level: 1, name: copy.week.overviewTitle })).toBeVisible();
  // This week opens from the summary, and there is a way back.
  await page.getByRole('link', { name: new RegExp(copy.week.openWeek) }).click();
  await page.waitForURL(/\/week\?w=/);
  await expect(page.getByRole('heading', { level: 1, name: copy.week.thisWeek })).toBeVisible();
  await page.locator('#main').getByRole('link', { name: copy.week.overviewTitle }).click();
  await page.waitForURL(/\/week$/);
  await bar.getByRole('link', { name: copy.nav.today }).click();
  await page.waitForURL(/\/$/);
  await expect(page.getByRole('heading', { name: copy.today.listTitle })).toBeVisible();

  // The summary loads (its figures may be empty on a fresh review database).
  await page.goto('/week');
  await expect(page.getByRole('heading', { level: 1, name: copy.week.overviewTitle })).toBeVisible();

  problems.assertClean();
});
