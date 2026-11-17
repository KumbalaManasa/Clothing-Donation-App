import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_URL = 'http://localhost:4000'
const FIXTURE_IMAGE = path.join(__dirname, '..', '..', 'backend', 'scripts', 'fixtures', 'test-image.png')

// Task 12.6 — full donor journey (spec.md §6.1, §2, §6.4 step 5): create a
// listing with a real photo through the actual UI, see its status update as
// it moves through the pipeline, and see the delivery confirmation once
// delivered. The NGO-side steps (claim/pickup/distribute) that drive that
// progression are performed via direct API calls, not the NGO's own UI —
// that full NGO-side journey is task 12.7's test, not this one; here they're
// just the offstage trigger for what the donor is supposed to see update.
test('full donor journey: create a listing, see it progress, and receive a delivery confirmation', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 12.9352, longitude: 77.6245 })

  const stamp = Date.now()
  const donorEmail = `e2e-donor-${stamp}@example.com`

  await page.goto('/donor')
  await page.getByRole('button', { name: 'Need an account? Sign up' }).click()
  await page.getByLabel('Name').fill('E2E Donor')
  await page.getByLabel('Phone').fill('+10000000100')
  await page.getByLabel('Email').fill(donorEmail)
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()

  // Signed up and logged in — the create-listing form appears.
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByLabel('Category').fill('Shirt')
  await page.getByLabel('Condition').fill('Good')
  await page.getByLabel('Photo').setInputFiles(FIXTURE_IMAGE)
  await expect(page.getByTestId('photo-status')).toHaveText('Uploaded', { timeout: 10000 })

  await page.getByRole('button', { name: 'Use my current location' }).click()
  await expect(page.getByTestId('pickup-pin')).toBeVisible()
  await expect(page.getByTestId('pickup-address-input')).toHaveValue('Koramangala', { timeout: 10000 })

  const [createResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().endsWith('/listings') && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Submit listing' }).click(),
  ])
  const { id: listingId } = await createResponse.json()

  await expect(page).toHaveURL(/\/donor\/listings/)
  await expect(page.getByTestId('listing-status').first()).toHaveText('Listed')
  await expect(page.getByTestId('listing-item-photo').first()).toBeVisible()

  // Offstage: an NGO claims, picks up, and distributes the listing via the API.
  const ngoEmail = `e2e-ngo-${stamp}@example.com`
  await fetch(`${BACKEND_URL}/auth/signup/ngo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E NGO',
      email: ngoEmail,
      phone: '+10000000101',
      password: 'correct-horse-battery-staple',
      org_name: 'E2E Org',
      registration_number: `APPROVED-E2E-${stamp}`,
    }),
  })
  const ngoLoginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ngoEmail, password: 'correct-horse-battery-staple' }),
  })
  const { token: ngoToken } = await ngoLoginRes.json()

  const claimRes = await fetch(`${BACKEND_URL}/listings/${listingId}/claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ngoToken}` },
  })
  const claim = await claimRes.json()

  await fetch(`${BACKEND_URL}/claims/${claim.id}/pickup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ngoToken}` },
  })

  await fetch(`${BACKEND_URL}/claims/${claim.id}/distribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngoToken}` },
    body: JSON.stringify({ receiver_first_name: 'Asha', receiver_general_area: 'Koramangala' }),
  })

  // MyListingsPage polls every 5s (task 9.6) — wait for the badge to catch up.
  await expect(page.getByTestId('listing-status').first()).toHaveText('Delivered', { timeout: 15000 })
  await expect(page.getByTestId('delivery-confirmation-note')).toBeVisible()
})
