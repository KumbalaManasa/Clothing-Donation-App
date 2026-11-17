import { defineConfig, devices } from '@playwright/test'

// Task 12.5 — E2E framework setup. webServer starts the real Vite dev server
// (task 0.5) automatically so `npm run test:e2e` and CI both just work
// without a manually-started frontend; reuseExistingServer lets a developer
// keep their own `npm run dev` running locally instead of a second instance.
//
// Task 12.6 added the second webServer entry: the real backend, always
// forced to NODE_ENV=test so it connects to knexfile.js's `test` environment
// (TEST_DATABASE_URL) — the same isolated database task 12.3's `npm test`
// harness already provisions/migrates, never the developer's dev data. In CI
// (see .github/workflows/ci.yml's `e2e` job), TEST_DATABASE_URL points at a
// throwaway Postgres service instead, and a migration step runs before this
// config's webServer starts the backend.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      // DEV_HTTPS=0: this config's baseURL/health checks are plain
      // http://localhost, which the LAN self-signed dev cert (Code/certs/,
      // see vite.config.js) would otherwise override to HTTPS. Not needed
      // for E2E anyway — localhost already counts as a secure context.
      env: { ...process.env, DEV_HTTPS: '0' },
    },
    {
      command: 'npm start',
      cwd: '../backend',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: { ...process.env, NODE_ENV: 'test', DEV_HTTPS: '0' },
    },
  ],
})
