/**
 * MY PHOTO — set in Settings, seen where the two of us appear, removable.
 * It removes what it set, so the rest of the suite sees the lights as before.
 */

import { expect, test } from '@playwright/test';

import { copy } from '@/domain/copy';

import { login, watchForProblems } from '../helpers';
import { OWNER } from './helpers';

test('a partner sets their photo in settings, sees it on Today, and can remove it', async ({ page }) => {
  const problems = watchForProblems(page);
  await login(page, OWNER);
  await page.goto('/settings');

  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#3068d0';
    context.fillRect(0, 0, 300, 300);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/profile-photo') && r.request().method() === 'PUT');
  await page.getByTestId('profile-photo-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('button', { name: copy.settings.photoRemove })).toBeVisible();

  // Today's header shows the face, served only to the couple.
  await page.goto('/');
  const face = page.locator('header img.avatar').first();
  await expect(face).toBeVisible();
  await expect(face).toHaveJSProperty('complete', true);
  expect(await face.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  // And it can be taken away again.
  await page.goto('/settings');
  const removed = page.waitForResponse((r) => r.url().endsWith('/api/profile-photo') && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: copy.settings.photoRemove }).click();
  // It asks first.
  const confirm = page.getByRole('dialog', { name: copy.settings.photoRemoveTitle });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: copy.tasks.removePhotoConfirm, exact: true }).click();
  expect((await removed).status()).toBe(200);
  await expect(page.getByRole('button', { name: copy.settings.photoChoose })).toBeVisible();

  problems.assertClean();
});
