const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

// Task 12.4 — integration test for spec.md §6.2 "Donor: Cancel Listing":
// 1. Available only while status is Listed or Claimed.
// 2. Donor selects/enters a reason.
// 3. Status -> Cancelled; if it was Claimed, the NGO is notified.
// Consolidates listings-cancel-status.test.js, listings-cancel-persist.test.js,
// and listings-cancel-notifies-ngo.test.js (tasks 3.8/3.9/3.10) into one file.
// The "reason required" validation rule itself (task 3.7) lives in
// validation-rules.test.js (task 12.2) — that's an input-validation concern,
// not this flow's status/notification behavior.

after(async () => {
  await db.destroy();
});

test('POST /listings/:id/cancel persists cancellation_reason and status=cancelled on the DB row', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `flow-6.2-persist-${Date.now()}@example.com`;

  const [donor] = await db('users')
    .insert({ name: 'Cancel Persist Test Donor', email, phone: '+10000000027', role: 'donor' })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const token = signSessionToken({ id: donor.id, role: 'donor' });
  const reason = 'Found another way to donate these';

  try {
    const res = await fetch(`http://localhost:${port}/listings/${listing.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    });

    assert.strictEqual(res.status, 200);

    const row = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(row.status, 'cancelled');
    assert.strictEqual(row.cancellation_reason, reason);
  } finally {
    await db('listings').where({ id: listing.id }).delete();
    await db('users').where({ id: donor.id }).delete();
    server.close();
  }
});

test('POST /listings/:id/cancel on a claimed listing creates a cancelled notification for the assigned NGO', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const donorEmail = `flow-6.2-notify-donor-${Date.now()}@example.com`;
  const ngoEmail = `flow-6.2-notify-ngo-${Date.now()}@example.com`;

  const [donor] = await db('users')
    .insert({ name: 'Notify Test Donor', email: donorEmail, phone: '+10000000025', role: 'donor' })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Notify Test NGO',
      email: ngoEmail,
      phone: '+10000000026',
      role: 'ngo',
      org_name: 'Notify Org',
      registration_number: `REG-NOTIFY-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'claimed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  await db('claims').insert({ listing_id: listing.id, ngo_id: ngo.id, status: 'active' });

  const donorToken = signSessionToken({ id: donor.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/listings/${listing.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ reason: 'No longer available' }),
    });

    assert.strictEqual(res.status, 200);

    const notifications = await db('notifications').where({
      user_id: ngo.id,
      listing_id: listing.id,
      type: 'cancelled',
    });
    assert.strictEqual(notifications.length, 1);
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ listing_id: listing.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').where({ id: donor.id }).delete();
    await db('users').where({ id: ngo.id }).delete();
    server.close();
  }
});

async function createDonorWithListing(status) {
  const email = `flow-6.2-status-${status}-${Date.now()}@example.com`;
  const [donor] = await db('users')
    .insert({ name: `Cancel Status Test Donor ${status}`, email, phone: '+10000000024', role: 'donor' })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status,
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const token = signSessionToken({ id: donor.id, role: 'donor' });
  return { donorId: donor.id, listingId: listing.id, token };
}

async function cleanup(donorId, listingId) {
  await db('listings').where({ id: listingId }).delete();
  await db('users').where({ id: donorId }).delete();
}

for (const status of ['picked_up', 'distributed', 'delivered']) {
  test(`POST /listings/:id/cancel on a '${status}' listing returns 409`, async () => {
    const server = app.listen(0);
    const { port } = server.address();
    const { donorId, listingId, token } = await createDonorWithListing(status);

    try {
      const res = await fetch(`http://localhost:${port}/listings/${listingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Changed my mind' }),
      });

      assert.strictEqual(res.status, 409);
    } finally {
      await cleanup(donorId, listingId);
      server.close();
    }
  });
}
