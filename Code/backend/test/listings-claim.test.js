const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /listings/:id/claim on a listed listing returns 201, creates a claims row with expires_at = claimed_at + 48h, and transitions the listing to claimed', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Claim Test Donor',
      email: `listings-claim-donor-${Date.now()}@example.com`,
      phone: '+10000000039',
      role: 'donor',
    })
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
  const [ngo] = await db('users')
    .insert({
      name: 'Claim Test NGO',
      email: `listings-claim-ngo-${Date.now()}@example.com`,
      phone: '+10000000040',
      role: 'ngo',
      org_name: 'Claim Org',
      registration_number: `REG-CLAIM-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/listings/${listing.id}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.listing_id, listing.id);
    assert.strictEqual(body.ngo_id, ngo.id);

    const claimRow = await db('claims').where({ listing_id: listing.id }).first();
    assert.ok(claimRow, 'claim row should exist');
    const gapMs = new Date(claimRow.expires_at).getTime() - new Date(claimRow.claimed_at).getTime();
    assert.strictEqual(gapMs, 48 * 60 * 60 * 1000);

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(listingRow.status, 'claimed');
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ listing_id: listing.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').where({ id: donor.id }).delete();
    await db('users').where({ id: ngo.id }).delete();
    server.close();
  }
});
