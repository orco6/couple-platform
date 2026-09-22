import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { access } from '@/domain/contract';
import { rolesWithout, topRoles } from '@/core/access/role-queries';

/** Mirrors scripts/lib/fixtures.ts (local/E2E databases only). */
export const PASSWORD = 'yesod-dev-password';

/** Fixture username for a role: "<role>" (n=1) or "<role>2" (n=2). */
export function usernameFor(role: string, n: 1 | 2 = 1): string {
  const base = role.toLowerCase().replace(/_/g, '-');
  return n === 1 ? base : `${base}2`;
}

const unprivileged = rolesWithout('users.read').sort((a, b) => access.permissionsOf(a).size - access.permissionsOf(b).size)[0];

/**
 * Role-agnostic users for CORE specs. Sample specs may use sample role names.
 *   top           can manage everyone
 *   unprivileged  cannot read users (ordinary staff)
 *   pending       must change password on first sign-in
 *   disabled      cannot sign in
 */
export const CORE_USERS = {
  top: usernameFor(topRoles()[0]!),
  unprivileged: usernameFor(unprivileged ?? access.defaultRole),
  unprivileged2: usernameFor(unprivileged ?? access.defaultRole, 2),
  pending: 'pending',
  disabled: 'disabled',
};

export async function login(page: Page, username: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('שם משתמש').fill(username);
  await page.getByLabel('סיסמה', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Sign in through the API for a request context (cookie is stored on the context). */
export async function apiLogin(request: APIRequestContext, baseURL: string, username: string): Promise<void> {
  const response = await request.post('/api/auth/login', {
    data: { username, password: PASSWORD },
    headers: { Origin: baseURL },
  });
  expect(response.status()).toBe(200);
}

/** Collects console errors, uncaught exceptions and 5xx responses; assert at the end. */
export function watchForProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    // The browser logs every 4xx fetch as a console error; validation (400) and
    // permission (403/404) responses are expected behaviour in these flows.
    // 5xx responses are still caught below.
    if (message.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(message.text())) {
      problems.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return { assertClean: () => expect(problems, problems.join('\n')).toEqual([]) };
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'page scrolls sideways').toBeLessThanOrEqual(clientWidth + 1);
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36).slice(-5)}`;
}
