const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

// Task 12.4 — integration test for spec.md §6.4 "NGO: Claim -> Pickup ->
// Distribute": browse/claim a listed listing, mark picked up, distribute with
// receiver info (system auto-delivers), donor gets a confirmation. Renamed
// from notifications-donor-journey-audit.test.js (task 7.3) — same test,
// this is exactly the full core-flow walk that task already built.

after(async () => {
  await db.destroy();
});

test('the full donor journey (list -> claimed -> picked up -> distributed/delivered) produces exactly the 4 expected notifications, in order', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Journey Audit Test Donor',
      email: `flow-6.4-donor-${Date.now()}@example.com`,
      phone: '+10000000084',
      role: 'donor',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Journey Audit Test NGO',
      email: `flow-6.4-ngo-${Date.now()}@example.com`,
      phone: '+10000000085',
      role: 'ngo',
      org_name: 'Journey Audit Org',
      registration_number: `REG-JOURNEYAUDIT-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const donorToken = signSessionToken({ id: donor.id, role: 'donor' });
  const ngoToken = signSessionToken({ id: ngo.id, role: 'ngo' });

  let listingId;
  try {
    // 1. Donor creates a listing.
    const createRes = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({
        items: [{ category: 'Shirt', condition: 'Good', photo_url: 'https://example.com/1.jpg' }],
        pickup_lat: 12.9,
        pickup_lng: 77.5,
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createdListing = await createRes.json();
    listingId = createdListing.id;

    // 2. NGO claims it.
    const claimRes = await fetch(`http://localhost:${port}/listings/${listingId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
    });
    assert.strictEqual(claimRes.status, 201);
    const claim = await claimRes.json();

    // 3. NGO marks it picked up.
    const pickupRes = await fetch(`http://localhost:${port}/claims/${claim.id}/pickup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ngoToken}` },
    });
    assert.strictEqual(pickupRes.status, 200);

    // 4. NGO distributes it (auto-delivers).
    const distributeRes = await fetch(`http://localhost:${port}/claims/${claim.id}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngoToken}` },
      body: JSON.stringify({ receiver_first_name: 'Asha', receiver_general_area: 'Koramangala' }),
    });
    assert.strictEqual(distributeRes.status, 201);

    const notifications = await db('notifications')
      .where({ user_id: donor.id, listing_id: listingId })
      .orderBy('created_at', 'asc');
    const types = notifications.map((n) => n.type);

    assert.deepStrictEqual(types, ['claimed', 'picked_up', 'distributed', 'delivered']);
  } finally {
    if (listingId) {
      await db('notifications').where({ listing_id: listingId }).delete();
      await db('distributions').where({ listing_id: listingId }).delete();
      await db('claims').where({ listing_id: listingId }).delete();
      await db('listing_items').where({ listing_id: listingId }).delete();
      await db('listings').where({ id: listingId }).delete();
    }
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
