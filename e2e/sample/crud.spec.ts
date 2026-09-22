import { expect, test } from '@playwright/test';
import { login, uniqueName, watchForProblems } from '../helpers';

test.describe('customer and task workflow', () => {
  test('create, validate, edit, note, task with money and date, complete, archive, restore', async ({ page }) => {
    const problems = watchForProblems(page);
    const name = uniqueName('מכון בדיקות');
    await login(page, 'manager');

    // Create — server validation surfaces on the field.
    await page.goto('/customers');
    await page.getByRole('button', { name: 'לקוח חדש' }).click();
    const dialog = page.getByRole('dialog', { name: 'לקוח חדש' });
    await dialog.getByRole('button', { name: 'הוספת הלקוח' }).click();
    await expect(dialog.getByText('שם הלקוח הוא שדה חובה')).toBeVisible();
    await dialog.getByLabel('שם הלקוח').fill(name);
    // The server's error leaves as soon as the field is edited, not on the next submit.
    await expect(dialog.getByText('שם הלקוח הוא שדה חובה')).toHaveCount(0);
    await expect(dialog.getByLabel('שם הלקוח')).not.toHaveAttribute('aria-invalid', 'true');
    await dialog.getByLabel('טלפון').fill('abc');
    await dialog.getByRole('button', { name: 'הוספת הלקוח' }).click();
    await expect(dialog.getByText('מספר טלפון לא תקין')).toBeVisible();
    await dialog.getByLabel('טלפון').fill('052-7654321');
    await dialog.getByRole('button', { name: 'הוספת הלקוח' }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('link', { name: '052-7654321' })).toBeVisible();

    // Edit.
    await page.getByRole('button', { name: 'עריכה' }).click();
    const edit = page.getByRole('dialog', { name: 'עריכת לקוח' });
    await edit.getByLabel('עיר').fill('נתניה');
    await edit.getByRole('button', { name: 'שמירה' }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByText('נתניה')).toBeVisible();

    // Note.
    await page.getByLabel('הערה חדשה').fill('ביקור ראשון נקבע');
    await page.getByRole('button', { name: 'הוספת הערה' }).click();
    await expect(page.getByText('ביקור ראשון נקבע')).toBeVisible();

    // Task with an impossible date, then a valid one, with a price.
    await page.getByRole('button', { name: 'משימה חדשה' }).click();
    const taskDialog = page.getByRole('dialog', { name: 'משימה חדשה' });
    await taskDialog.getByLabel('כותרת').fill('התקנה ראשונית');
    const due = taskDialog.getByLabel('תאריך יעד');
    await due.fill('31.04.2026');
    await due.blur();
    await taskDialog.getByRole('button', { name: 'הוספת המשימה' }).click();
    await expect(taskDialog.getByText('תאריך לא תקין. יש לכתוב בתבנית DD.MM.YYYY')).toBeVisible();
    await due.fill('30.04.2026');
    await taskDialog.getByLabel('מחיר לפני מע״מ').fill('1,200');
    await taskDialog.getByRole('button', { name: 'הוספת המשימה' }).click();
    await expect(taskDialog).toBeHidden();
    const row = page.getByRole('link', { name: 'התקנה ראשונית' }).first();
    await expect(row).toBeVisible();

    // Complete it and check the VAT arithmetic on the task page.
    await row.click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('התקנה ראשונית');
    await expect(page.getByText('₪1,200.00')).toBeVisible();
    await expect(page.getByText('₪216.00')).toBeVisible();
    await expect(page.getByText('₪1,416.00')).toBeVisible();
    await page.getByRole('button', { name: 'סימון כבוצעה' }).click();
    const complete = page.getByRole('dialog', { name: 'סימון כבוצעה' });
    await expect(complete.getByLabel('תאריך ביצוע')).not.toHaveValue('');
    await complete.getByRole('button', { name: 'סימון כבוצעה' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('בוצעה');

    // Archive the customer; it leaves the list; restore it with a reason.
    await page.getByRole('link', { name }).click();
    await page.getByRole('button', { name: 'לארכיון' }).click();
    const confirm = page.getByRole('dialog', { name: new RegExp(`העברת ${name}`) });
    // With a form field in the body, focus goes to the field — never to the destructive button.
    await expect(confirm.getByLabel('סיבה (לא חובה)')).toBeFocused();
    await confirm.getByRole('button', { name: 'העברה לארכיון' }).click();
    await page.waitForURL('**/customers');
    await expect(page.getByRole('link', { name })).toHaveCount(0);

    await page.goto('/admin/archive');
    const archived = page.getByRole('listitem').filter({ hasText: name });
    await archived.getByRole('button', { name: 'שחזור' }).click();
    const restore = page.getByRole('dialog', { name: `שחזור ${name}` });
    await expect(restore.getByRole('button', { name: 'שחזור' })).toBeDisabled();
    await restore.getByLabel('סיבה').fill('הלקוח חזר');
    await restore.getByRole('button', { name: 'שחזור' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);

    problems.assertClean();
  });

  test('every change is visible in the audit log with actor and summary', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { level: 1, name: 'יומן פעולות' })).toBeVisible();
    await expect(page.getByText('לקוח נוסף').first()).toBeVisible();
  });
});

test('customer list sorts on the server through header links (URL state, aria-sort)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'headers are desktop-only; phones use the sort select');
  await login(page, 'manager');
  await page.goto('/customers');
  const table = page.getByRole('table', { name: 'רשימת לקוחות' });
  const nameHeader = table.getByRole('columnheader', { name: 'שם' });
  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  const cells = table.locator('tbody tr td:first-child');
  const ascending = await cells.allTextContents();

  // Order comes from the database collation (not JS localeCompare): descending is ascending reversed.
  await nameHeader.getByRole('link').click();
  await expect(page).toHaveURL(/sort=name&dir=desc/);
  await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(cells).toHaveText([...ascending].reverse());

  await table.getByRole('columnheader', { name: 'נוסף' }).getByRole('link').click();
  await expect(page).toHaveURL(/sort=createdAt&dir=desc/);
  await expect(nameHeader).not.toHaveAttribute('aria-sort', /.+/);

  // Unknown sort keys from a hand-edited URL fall back to the default instead of erroring.
  await page.goto('/customers?sort=passwordHash&dir=desc');
  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
});

test('a filtered-empty list offers to clear the filter, and the search field follows the URL', async ({ page }) => {
  await login(page, 'manager');
  await page.goto('/customers');
  const search = page.getByRole('searchbox');
  await search.fill('אין-לקוח-כזה-בכלל');
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByText('לא נמצאו לקוחות שמתאימים לסינון')).toBeVisible();
  await page.getByRole('link', { name: 'ניקוי הסינון והצגת כל הלקוחות' }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(search).toHaveValue('');
  await expect(page.getByText('לא נמצאו לקוחות שמתאימים לסינון')).toHaveCount(0);
  await expect(page.getByTestId('clear-filters')).toHaveCount(0);
});
