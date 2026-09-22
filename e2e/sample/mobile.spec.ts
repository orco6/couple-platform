import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, login, watchForProblems } from '../helpers';

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile layout only');

  test('bottom navigation, the "more" sheet, and no sideways scrolling', async ({ page }) => {
    const problems = watchForProblems(page);
    await login(page, 'manager');

    const bar = page.getByRole('navigation', { name: 'ניווט ראשי' }).last();
    await expect(bar).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await bar.getByRole('link', { name: 'לקוחות' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'לקוחות' })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'לקוחות' })).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page);

    await bar.getByRole('link', { name: 'משימות' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'משימות' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await bar.getByRole('button', { name: 'עוד' }).click();
    const sheet = page.getByTestId('mobile-more-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('link', { name: 'הכנסות' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'הכנסות' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    problems.assertClean();
  });

  test('forms open as bottom sheets with the primary action reachable', async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/customers');
    await page.getByRole('button', { name: 'לקוח חדש' }).click();
    const dialog = page.getByRole('dialog', { name: 'לקוח חדש' });
    const submit = dialog.getByRole('button', { name: 'הוספת הלקוח' });
    await expect(submit).toBeInViewport();
    const box = (await submit.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44); // touch target
    await dialog.getByRole('button', { name: 'ביטול' }).click();
    await expect(dialog).toBeHidden();
  });
});
