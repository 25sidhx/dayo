---
name: playwright
description: A skill for writing and running automated browser tests using Playwright. Use this whenever you need to verify that a UI flow or feature works end-to-end in a real browser.
---

# Playwright Skill

## What This Skill Does
Playwright lets me open a real browser (Chromium, Firefox, or WebKit), navigate your app, click buttons, fill forms, and verify that everything works — just like a real user.

## Setup Steps (run once)

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Create `playwright.config.ts` in the project root:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    headless: false, // set true for CI
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
```

## Writing Tests

Tests go in the `e2e/` folder. Example:

```ts
// e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test('user can upload a timetable and see extracted classes', async ({ page }) => {
  await page.goto('/onboarding');
  
  // Confirm the upload step is visible
  await expect(page.getByText('Provide Timetable')).toBeVisible();

  // Upload a test image
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures/sample-timetable.png'));
  
  // Click the extraction button
  await page.getByRole('button', { name: /Execute Extraction/i }).click();

  // Wait for the review grid to appear (allow up to 30s for AI processing)
  await expect(page.getByText('Review Extraction')).toBeVisible({ timeout: 30000 });
  
  // Confirm at least one class row was extracted
  await expect(page.locator('tbody tr')).toHaveCount({ min: 1 }, { timeout: 5000 });
});

test('user can commit schedule and enter chat onboarding', async ({ page }) => {
  // ... (after extraction is confirmed)
  await page.getByRole('button', { name: /Commit & Continue/i }).click();
  await expect(page.getByText('Designing Your Day')).toBeVisible();
  await expect(page.getByText("Awesome! I've got your classes")).toBeVisible();
});
```

## Running Tests

```bash
# Run all e2e tests
npx playwright test

# Run with visible browser (non-headless)
npx playwright test --headed

# Run a specific test file
npx playwright test e2e/onboarding.spec.ts

# View the detailed HTML report
npx playwright show-report
```

## When I Use This Skill

After implementing any significant UI feature, I will:
1. Write a test in `e2e/` covering the happy path
2. Run `npx playwright test --headed` to verify it visually
3. Fix any failures before reporting completion

## Test Fixtures

Store test assets in `e2e/fixtures/`:
- `sample-timetable.png` — a simple college timetable image for upload tests
- `test-user.json` — mock user preferences for onboarding tests

## Best Practices
- Use `getByRole` and `getByText` selectors (more resilient than CSS selectors)
- Set generous timeouts for AI operations (`timeout: 30000`)
- Always take a screenshot on failure for debugging
- Tests should be **independent** — each test sets up its own state
