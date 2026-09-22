/** SAMPLE DOMAIN: axe WCAG A/AA checks on the sample's screens — delete with the sample. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from '../helpers';

test('sample screens have no WCAG A/AA violations', async ({ page }) => {
  await login(page, 'manager');
  for (const path of ['/customers', '/tasks', '/reports/revenue', '/admin/archive']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page).toHaveTitle(/\S/);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`), path).toEqual([]);
  }
  await page.goto('/customers');
  await page.getByRole('table', { name: 'רשימת לקוחות' }).locator('tbody a').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Reached by client navigation: wait until Next.js has swapped in the record's title (it is empty for
  // a few frames mid-swap), then assert it names the record rather than only the app.
  await expect(page).toHaveTitle(/\S+ · /);
  const detail = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(detail.violations.map((v) => v.id), 'customer detail').toEqual([]);
});
