/**
 * CORE: automated accessibility checks (axe-core, WCAG 2.1 A/AA rules) on the
 * platform's own pages and component gallery. Automated rules catch roughly a
 * third of real problems — MANUAL_QA.md keeps the keyboard and screen-reader pass.
 * Domain projects add their own pages in e2e/<area>.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { CORE_USERS, login } from '../helpers';

async function violations(page: Page) {
  // The page title is streamed and swapped during client navigation; analyse the settled document.
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`);
}

test('sign-in page has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'כניסה' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('core pages and the component gallery have no WCAG A/AA violations', async ({ page }) => {
  await login(page, CORE_USERS.top);
  for (const path of ['/', '/attention', '/account', '/admin/users', '/admin/audit', '/admin/settings', '/design-system']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await violations(page), path).toEqual([]);
  }
});
