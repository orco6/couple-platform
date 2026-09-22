/**
 * Shared primitives, on the component gallery (/design-system). Runs on both
 * desktop and mobile projects: the same Dialog is a centred dialog on one and a
 * bottom sheet on the other.
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/design-system');
});

test('dialog: focus moves in, Tab is trapped, Escape closes, focus returns', async ({ page, isMobile }) => {
  const trigger = page.getByRole('button', { name: 'פתיחת דיאלוג' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'דיאלוג לדוגמה' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('שדה ראשון')).toBeFocused();

  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await dialog.evaluate((element) => element.contains(document.activeElement));
    expect(inside).toBe(true);
  }

  // Presentation depends on width: sheet attached to the bottom on phones, centred on desktop.
  const panel = dialog.locator('.overlay-panel');
  await expect(async () => {
    const box = (await panel.boundingBox())!;
    const viewport = page.viewportSize()!;
    if (isMobile) expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThan(2);
    else expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(4);
  }).toPass();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('backdrop click closes; the page behind cannot scroll while open', async ({ page }) => {
  await page.getByRole('button', { name: 'פתיחת גיליון תחתון' }).click();
  const sheet = page.getByTestId('gallery-sheet');
  await expect(sheet).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.mouse.click(10, 10);
  await expect(sheet).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('confirmation: Cancel has initial focus and a double click confirms once', async ({ page }) => {
  await page.getByRole('button', { name: 'פתיחת אישור' }).click();
  const dialog = page.getByRole('dialog', { name: 'מחיקת הערה' });
  await expect(dialog.getByRole('button', { name: 'ביטול' })).toBeFocused();
  await dialog.getByRole('button', { name: 'מחיקה' }).dblclick();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('confirm-count')).toHaveText('אישורים: 1');
});

test('date input: strict day-first parsing with a visible error for impossible dates', async ({ page }) => {
  const input = page.getByTestId('gallery-date');
  await input.fill('31.04.2026');
  await input.blur();
  await expect(page.getByText('תאריך לא תקין. יש לכתוב בתבנית DD.MM.YYYY')).toBeVisible();
  await expect(page.getByTestId('gallery-date-value')).toHaveText('ריק');

  await input.fill('1/10/2026');
  await input.blur();
  await expect(input).toHaveValue('01.10.2026');
  await expect(page.getByTestId('gallery-date-value')).toHaveText('2026-10-01');
});

test('money input: typed shekels become exact agorot', async ({ page }) => {
  const input = page.getByTestId('gallery-money');
  await input.fill('1,180.5');
  await expect(page.getByTestId('gallery-money-value')).toHaveText('118050');
  await input.blur();
  await expect(input).toHaveValue('1180.50');
  await input.fill('12.345');
  await expect(page.getByTestId('gallery-money-value')).toHaveText('ריק');
});

test('disclosure exposes its state to assistive technology', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'פרטים נוספים' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('תוכן שנפתח ונסגר')).toBeVisible();
});

test('reduced motion: overlays fade without moving', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'פתיחת דיאלוג' }).click();
  const panel = page.getByRole('dialog', { name: 'דיאלוג לדוגמה' }).locator('.overlay-panel');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  expect(await panel.evaluate((element) => getComputedStyle(element).transitionDuration)).toContain('0.12s');
});

test('toast is announced politely', async ({ page }) => {
  await page.getByRole('button', { name: 'הודעה קצרה' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'הפעולה הושלמה' })).toBeVisible();
});

test('time input: strict 24-hour HH:MM', async ({ page }) => {
  const input = page.getByTestId('gallery-time');
  await input.fill('9:05');
  await expect(page.getByTestId('gallery-time-value')).toHaveText('09:05');
  await input.blur();
  await expect(input).toHaveValue('09:05');
  await input.fill('25:00');
  await input.blur();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  // What is on screen is not a valid time, so the form must not keep the previous one.
  await expect(page.getByTestId('gallery-time-value')).toHaveText('ריק');
  await input.fill('23:59');
  await expect(page.getByTestId('gallery-time-value')).toHaveText('23:59');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
});

test('money input: negative amounts only where allowed', async ({ page }) => {
  await page.getByTestId('gallery-money-signed').fill('-120.5');
  await expect(page.getByTestId('gallery-money-signed-value')).toHaveText('-12050');
  await page.getByTestId('gallery-money').fill('-5');
  await expect(page.getByTestId('gallery-money-value')).toHaveText('ריק');
  await expect(page.getByTestId('gallery-money')).toHaveAttribute('aria-invalid', 'true');
});

test('button: loading keeps the exact width and stays focusable', async ({ page }) => {
  const button = page.getByTestId('gallery-loading-button');
  const before = await button.boundingBox();
  await button.click();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  const during = await button.boundingBox();
  expect(Math.round(during!.width)).toBe(Math.round(before!.width));
  // A fast save never flashes a spinner: the label stays for the first 150ms.
  const delays = await button.evaluate((element) =>
    element.getAnimations({ subtree: true }).map((animation) => (animation.effect as KeyframeEffect).getTiming().delay),
  );
  expect(delays.filter((delay) => delay === 150).length).toBeGreaterThanOrEqual(2);
  await expect(button).toBeFocused();
  await expect(button).not.toHaveAttribute('aria-busy', 'true', { timeout: 3000 });
});

test('narrow action row: long Hebrew labels fit without overflowing', async ({ page }) => {
  const box = page.getByTestId('gallery-narrow-actions');
  const overflow = await box.evaluate((element) =>
    Array.from(element.querySelectorAll('button')).some((button) => button.scrollWidth > button.clientWidth + 1),
  );
  expect(overflow).toBe(false);
});

test('a menu item that opens a dialog waits until the sheet has closed', async ({ page }) => {
  await page.getByRole('button', { name: 'פתיחת גיליון תחתון' }).click();
  const sheet = page.getByTestId('gallery-sheet');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'פתיחת דיאלוג מהתפריט' }).click();
  const dialog = page.getByRole('dialog', { name: 'דיאלוג לדוגמה' });
  await expect(dialog).toBeVisible();
  // By the time the dialog is open, the sheet is fully gone (not two overlays animating together).
  expect(await sheet.count()).toBe(0);
});

test('ordinary statuses are quiet text; states that moved are chips', async ({ page }) => {
  const background = (label: string) =>
    page.locator('#statuses').getByText(label, { exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(await background('פתוחה')).toBe('rgba(0, 0, 0, 0)');
  expect(await background('בביצוע')).not.toBe('rgba(0, 0, 0, 0)');
});

test('date input: editing a valid date into an unreadable one never keeps the old date', async ({ page }) => {
  const input = page.getByTestId('gallery-date');
  await input.fill('30.04.2026');
  await expect(page.getByTestId('gallery-date-value')).toHaveText('2026-04-30');
  // What is on screen is not a date, so the form must not still hold 30.04.
  await input.fill('31.04.2026');
  await expect(page.getByTestId('gallery-date-value')).toHaveText('ריק');
  await expect(input).toHaveValue('31.04.2026');
  await input.fill('01.05.2026');
  await expect(page.getByTestId('gallery-date-value')).toHaveText('2026-05-01');
});

test('read-only fields look different from disabled ones, and selects are neither', async ({ page }) => {
  const style = (label: string) =>
    page.locator('#field-states').getByLabel(label, { exact: true }).evaluate((el) => getComputedStyle(el).borderTopStyle);
  expect(await style('לקריאה בלבד')).toBe('dashed');
  expect(await style('מושבת')).toBe('solid');
  expect(await page.locator('#forms').getByLabel('בחירה', { exact: true }).evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');
});

test('a long email address keeps its text and wraps only at its parts', async ({ page }) => {
  const link = page.locator('#record-states').getByRole('link', { name: 'accounts.payable@shaarei-tzedek-medical.org.il' });
  await expect(link).toHaveAttribute('href', 'mailto:accounts.payable@shaarei-tzedek-medical.org.il');
  expect(await link.evaluate((el) => getComputedStyle(el).wordBreak)).not.toBe('break-all');
});
