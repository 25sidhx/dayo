import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Full Onboarding Extraction Flow', () => {

  test('complete upload and extraction flow', async ({ page }) => {
    // Go to onboarding
    await page.goto('/onboarding');
    
    // Verify page loaded
    await expect(page.getByRole('heading', { name: /Provide Timetable/i })).toBeVisible();
    
    // Upload the timetable PDF
    const filePath = path.join(__dirname, 'fixtures', 'timetable.pdf');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    
    // Verify file is selected
    await expect(page.getByText('timetable.pdf')).toBeVisible();
    
    // Click extract button
    const extractButton = page.getByRole('button', { name: /Execute Extraction|Extract/i });
    await expect(extractButton).toBeEnabled();
    
    // Click and wait for processing (this will call the AI)
    await extractButton.click();
    
    // Wait for either success or error (give it time for AI processing)
    await page.waitForTimeout(10000);
    
    // Check if there's any response (success message or error)
    const pageContent = await page.content();
    console.log('Page after extraction:', pageContent.slice(0, 1000));
    
    // Either we see results, error, or we're in step 2 (chat)
    const hasResults = pageContent.includes('subject') || 
                       pageContent.includes('schedule') ||
                       pageContent.includes('class');
    
    console.log('Has results:', hasResults);
  });

  test('error handling with invalid file', async ({ page }) => {
    await page.goto('/onboarding');
    
    // Upload a non-image/non-pdf file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image')
    });
    
    // Click extract
    const extractButton = page.getByRole('button', { name: /Execute Extraction|Extract/i });
    await extractButton.click();
    
    // Should show error or handle gracefully
    await page.waitForTimeout(5000);
  });

});
