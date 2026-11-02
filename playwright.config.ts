import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * The suite runs against a real Next.js server talking to a real Go API and PostgreSQL, so
 * there is no mocking anywhere: what passes here is what the demo does.
 *
 * Requires a running backend (`:8080`) and credentials in the environment:
 *   set "E2E_USER=admin"& set "E2E_PASS=..."
 *
 * `webServer` reuses an already running dev/prod server, otherwise it starts one.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Workflow specs mutate shared data, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    // Deliberately a page that does NOT depend on the API: if the readiness probe used
    // /api/bff/health, a backend that is still starting would make Playwright think the
    // frontend is down and try to start a second server (EADDRINUSE).
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
