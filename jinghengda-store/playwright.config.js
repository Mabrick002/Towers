'use strict';

const { defineConfig, devices } = require('@playwright/test');
const fs = require('node:fs');

const PORT = 3123;
// Use the pre-installed Chromium when present (cloud dev environments); otherwise Playwright's own.
const localChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: fs.existsSync(localChromium) ? { executablePath: localChromium } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive/ },
  ],
  webServer: {
    command: 'node --disable-warning=ExperimentalWarning scripts/seed.js --reset && node --disable-warning=ExperimentalWarning server.js',
    url: `http://localhost:${PORT}/api/config`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      DATABASE_FILE: 'data/test.db',
      UPLOAD_DIR: 'data/test-uploads',
      ADMIN_EMAIL: 'admin@jinghengdainternational.com',
      ADMIN_PASSWORD: 'test-password-123',
      PAYMENT_PROVIDER: 'manual',
    },
  },
});
