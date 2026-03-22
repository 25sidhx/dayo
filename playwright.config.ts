import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3009',
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 120000,
});
