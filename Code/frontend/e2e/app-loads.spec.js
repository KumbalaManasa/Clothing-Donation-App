import { test, expect } from '@playwright/test'

// Task 12.5 — trivial E2E smoke test proving the framework itself works end
// to end (dev server starts, a real browser loads the app, an assertion
// runs) before tasks 12.6/12.7 build real donor/NGO journeys on top of it.
// A backend is started by playwright.config.js's webServer too (added for
// task 12.6), but this test itself never depends on it: BackendStatus.jsx
// fails gracefully to "backend: error" when it can't reach the API, so this
// stays a pure frontend-loads check regardless of backend health.
test('the app loads and shows the home page', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Clothing Donation App' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Donor' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'NGO' })).toBeVisible()
})
