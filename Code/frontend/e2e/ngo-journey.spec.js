import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_URL = 'http://localhost:4000'
const FIXTURE_IMAGE = path.join(__dirname, '..', '..', 'backend', 'scripts', 'fixtures', 'test-image.png')

// Task 12.7 — full NGO journey (spec.md §6.3, §6.4): signup with immediate
// auto-verification, browse open listings, claim, mark picked up, distribute
// with receiver info. Unlike task 12.6's donor-journey test (which drives the
// NGO's half via API calls), this one drives every NGO-side step through the
// NGO's own UI — that's the whole point of this task. The listing itself is
// created via API as an offstage donor, the same inversion 12.6 used for the
// NGO's half.
test('full NGO journey: signup, get auto-verified, claim, pick up, and distribute a listing', async ({ page }) => {
  const stamp = Date.now()
  const addressLabel = `E2E NGO Journey Test Address ${stamp}`

  // Offstage donor creates a listing for this NGO to find and claim.
  const donorEmail = `e2e-journey-donor-${stamp}@example.com`
  await fetch(`${BACKEND_URL}/auth/signup/donor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E Journey Donor',
      email: donorEmail,
      phone: '+10000000110',
      password: 'correct-horse-battery-staple',
    }),
  })
  const donorLoginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: donorEmail, password: 'correct-horse-battery-staple' }),
  })
  const { token: donorToken } = await donorLoginRes.json()

  const photoDataUri = `data:image/png;base64,${fs.readFileSync(FIXTURE_IMAGE).toString('base64')}`
  const uploadRes = await fetch(`${BACKEND_URL}/listings/upload-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
    body: JSON.stringify({ photo: photoDataUri }),
  })
  const { photo_url: photoUrl } = await uploadRes.json()

  await fetch(`${BACKEND_URL}/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
    body: JSON.stringify({
      items: [{ category: 'Sweater', condition: 'Good', photo_url: photoUrl }],
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: addressLabel,
    }),
  })

  // The NGO's actual journey starts here — everything from here on is UI-driven.
  const ngoEmail = `e2e-journey-ngo-${stamp}@example.com`

  await page.goto('/ngo')
  await page.getByRole('button', { name: 'Need an account? Sign up' }).click()
  await page.getByLabel('Name', { exact: true }).fill('E2E Journey NGO Contact')
  await page.getByLabel('Phone').fill('+10000000111')
  await page.getByLabel('Organization name').fill('E2E Journey Org')
  await page.getByLabel('Registration number').fill(`APPROVED-E2E-JOURNEY-${stamp}`)
  await page.getByLabel('Email').fill(ngoEmail)
  await page.getByLabel('Password').fill('correct-horse-battery-staple')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()

  // Signup triggers spec.md §6.3's synchronous verification — an
  // APPROVED-prefixed registration number verifies immediately, no separate
  // approval step, so browsing/claiming should already be available.
  await expect(page.getByTestId('ngo-verification-status')).toHaveAttribute('data-status', 'verified')
  await expect(page.getByTestId('browse-listings')).toBeVisible()

  const listingRow = page.getByTestId('open-listing-row').filter({ hasText: addressLabel })
  await expect(listingRow).toBeVisible({ timeout: 10000 })
  await listingRow.getByTestId('claim-button').click()

  // Claiming redirects to My Claims (task 10.5's own verify wording).
  await expect(page).toHaveURL(/\/ngo\/claims/)
  const claimRow = page.getByTestId('claim-row').filter({ hasText: addressLabel })
  await expect(claimRow).toBeVisible()
  await expect(claimRow.getByTestId('claim-listing-status')).toHaveAttribute('data-status', 'claimed')

  await claimRow.getByTestId('pickup-button').click()
  await expect(claimRow.getByTestId('claim-listing-status')).toHaveAttribute('data-status', 'picked_up')

  await claimRow.getByTestId('distribute-button').click()
  await expect(page.getByTestId('distribute-modal')).toBeVisible()
  await page.getByTestId('receiver-first-name-input').fill('Asha')
  await page.getByTestId('receiver-general-area-input').fill('Koramangala')
  await page.getByTestId('distribute-confirm').click()

  // Distribute auto-delivers in the same call (spec.md §4 note) — no
  // intermediate "distributed" state is ever shown to the NGO.
  await expect(claimRow.getByTestId('claim-listing-status')).toHaveAttribute('data-status', 'delivered')
})
