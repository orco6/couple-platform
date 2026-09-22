/**
 * PRIVACY — the couple's data belongs to the two people in the link, and to
 * nobody else who happens to hold an account on this deployment.
 *
 * The fixtures give us a third active account with the same PARTNER role
 * (`partner2`), which is the whole attack: not a stranger on the internet, but
 * a signed-in, correctly-authenticated user who is not in this couple. Every
 * test here is that account trying a door — by URL, and then by API, where
 * there is no UI to hide the control from them.
 */

import { expect, test, type APIRequestContext } from '@playwright/test';

import { copy } from '@/domain/copy';

import { apiLogin, login, uniqueName } from '../helpers';
import { OUTSIDER, OWNER, PARTNER, whoami } from './helpers';

/** Today, in the timezone the product runs in. */
function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

/** Creates a task owned by the owner, through the API, and returns it. */
async function seedTask(request: APIRequestContext, baseURL: string) {
  await apiLogin(request, baseURL, OWNER);
  const title = uniqueName('סוד');
  const ownerId = await whoami(request);
  const response = await request.post('/api/tasks', {
    data: { title, taskDate: today(), ownerId },
    headers: { Origin: baseURL },
  });
  expect(response.status(), await response.text()).toBe(201);
  const task = (await response.json()) as { id: string; version: number };
  return { ...task, title, ownerId };
}

/** A date the fixtures left closed by one partner only. */
function threeDaysAgo(): string {
  const now = new Date(`${today()}T12:00:00Z`);
  now.setUTCDate(now.getUTCDate() - 3);
  return now.toISOString().slice(0, 10);
}

test('a third account sees none of the couple’s list, by URL', async ({ page, request, baseURL }) => {
  const { title } = await seedTask(request, baseURL!);

  await login(page, OUTSIDER);
  for (const path of ['/', '/week', '/month', '/archive']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
  }

  // And not in the document either — not hidden, not in the RSC payload.
  const served = await page.request.get('/');
  expect(await served.text()).not.toContain(title);
});

test('a third account cannot reach the couple’s tasks by API', async ({ request, baseURL }) => {
  const task = await seedTask(request, baseURL!);

  await apiLogin(request, baseURL!, OUTSIDER);

  // Out of scope is 404: not "forbidden", which would confirm the row exists.
  const edited = await request.patch(`/api/tasks/${task.id}`, {
    data: { id: task.id, version: task.version, title: 'נכתב בידי זר' },
    headers: { Origin: baseURL! },
  });
  expect(edited.status()).toBe(404);

  const transitioned = await request.post(`/api/tasks/${task.id}/transition`, {
    data: { id: task.id, version: task.version, to: 'COMPLETED' },
    headers: { Origin: baseURL! },
  });
  expect(transitioned.status()).toBe(404);

  // Nor may they put a task into the couple's list — and this one carries a
  // real partner's id as the owner, so the refusal has to come from the couple
  // check rather than from the schema.
  const created = await request.post('/api/tasks', {
    data: { title: 'משימה שהושתלה', taskDate: today(), ownerId: task.ownerId },
    headers: { Origin: baseURL! },
  });
  expect(created.status(), await created.text()).toBe(422);
});

test('a third account cannot rate the couple’s completed task', async ({ request, baseURL }) => {
  const task = await seedTask(request, baseURL!);

  await apiLogin(request, baseURL!, OWNER);
  const completed = await request.post(`/api/tasks/${task.id}/transition`, {
    data: { id: task.id, version: task.version, to: 'COMPLETED' },
    headers: { Origin: baseURL! },
  });
  expect(completed.status()).toBe(200);

  await apiLogin(request, baseURL!, OUTSIDER);
  const rated = await request.post('/api/task-ratings', {
    data: { taskId: task.id, value: 1 },
    headers: { Origin: baseURL! },
  });
  expect(rated.status()).toBe(422);
  expect(await rated.text()).not.toContain(task.title);
});

test('the owner cannot rate their own task, whatever the client sends', async ({ request, baseURL }) => {
  const task = await seedTask(request, baseURL!);

  await apiLogin(request, baseURL!, OWNER);
  await request.post(`/api/tasks/${task.id}/transition`, {
    data: { id: task.id, version: task.version, to: 'COMPLETED' },
    headers: { Origin: baseURL! },
  });

  const rated = await request.post('/api/task-ratings', {
    data: { taskId: task.id, value: 5 },
    headers: { Origin: baseURL! },
  });
  expect(rated.status()).toBe(422);
});

test('forged identity fields are rejected, not ignored', async ({ request, baseURL }) => {
  await apiLogin(request, baseURL!, PARTNER);

  // The schemas are strict: an unknown key is a 400, so a client that thinks it
  // can name whose entry this is gets told no rather than quietly writing its own.
  for (const forged of [
    { entryDate: today(), respectRating: 5, partnerId: 'cmnot-a-real-id' },
    { entryDate: today(), respectRating: 5, revealed: true },
  ]) {
    const response = await request.post('/api/day-entries', { data: forged, headers: { Origin: baseURL! } });
    expect(response.status(), JSON.stringify(forged)).toBe(400);
  }

  // Same for a rating that tries to name its own author.
  const rated = await request.post('/api/task-ratings', {
    data: { taskId: 'cmnot-a-real-id', value: 5, ratedById: 'somebody-else' },
    headers: { Origin: baseURL! },
  });
  expect(rated.status()).toBe(400);
});

test('a rating outside 1–5 is refused by the schema, and the reveal is not a query parameter', async ({
  request,
  baseURL,
}) => {
  await apiLogin(request, baseURL!, PARTNER);

  for (const value of [0, 6, 2.5, -1]) {
    const response = await request.post('/api/task-ratings', {
      data: { taskId: 'cmnot-a-real-id', value },
      headers: { Origin: baseURL! },
    });
    expect(response.status(), `value ${value}`).toBe(400);
  }

  // R-DAY-05 has no client-side switch: asking for it does not grant it. Three
  // days ago is a day the fixtures left closed by ONE partner, so there is a
  // real withheld answer behind this request.
  await apiLogin(request, baseURL!, OWNER);
  const served = await request.get(`/review?reveal=1&date=${threeDaysAgo()}`);
  expect(served.status()).toBe(200);
  expect(await served.text()).not.toContain(copy.day.revealedTitle);
});
