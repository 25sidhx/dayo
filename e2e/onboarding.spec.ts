import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {

  test('upload page loads and shows correct heading', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: /Provide Timetable/i })).toBeVisible();
    await expect(page.getByText('Setup Phase • 01')).toBeVisible();
  });

  test('upload button is disabled while no file is selected', async ({ page }) => {
    await page.goto('/onboarding');
    const uploadButton = page.getByRole('button', { name: /Execute Extraction/i });
    await expect(uploadButton).toBeDisabled();
  });

  test('drop zone shows file name after selection', async ({ page }) => {
    await page.goto('/onboarding');

    // Set a file on the hidden input directly
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-timetable.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image content'),
    });

    // The filename should now appear in the drop zone
    await expect(page.getByText('test-timetable.png')).toBeVisible();
    
    // And the button should now be enabled
    const uploadButton = page.getByRole('button', { name: /Execute Extraction/i });
    await expect(uploadButton).toBeEnabled();
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Welcome back|Join SLS/i })).toBeVisible({ timeout: 5000 });
    // Verify both auth buttons are present (use .first() to avoid strict mode)
    await expect(page.getByRole('button', { name: /Sign In/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Account/i }).first()).toBeVisible();
  });

});
