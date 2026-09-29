// Browser E2E against an ISOLATED stack — never the shared Atlas-backed API:
//
//   backend   backend/tests/performance/perfServer.js on :5056 — the real app
//             on an in-memory MongoDB replica set, every third-party
//             credential blanked and outbound fetch blocked, small seed.
//   frontend  the Vite dev server on :5174, pointed at that backend, with
//             the admin mock layer switched off.
//
// Tests additionally abort any browser request that is not to localhost
// (fixtures.js), so Firebase/analytics/CDNs are never contacted.
//
//   cd e2e && npx playwright test

const { defineConfig, devices } = require('@playwright/test');

const API_PORT = 5056;
const WEB_PORT = 5174;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node tests/performance/perfServer.js',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: { PERF_PORT: String(API_PORT), PERF_PRODUCTS: '40', PERF_ORDERS: '0', PERF_FIXTURES: 'e2e' },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: '../frontend',
      url: `http://localhost:${WEB_PORT}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: `http://localhost:${API_PORT}`,
        VITE_USE_MOCKS: 'false',
        VITE_APP_ENV: 'development',
      },
    },
  ],
});
