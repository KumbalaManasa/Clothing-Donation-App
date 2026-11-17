const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /claims/:id/distribute lands the listing on delivered, never stops at distributed', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Distribute Status Test Donor',
      email: `claims-distribute-status-donor-${Date.now()}@example.com`,
      phone: '+10000000064',
      role: 'donor',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'picked_up',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Distribute Status Test NGO',
      email: `claims-distribute-status-ngo-${Date.now()}@example.com`,
      phone: '+10000000065',
      role: 'ngo',
      org_name: 'Distribute Status Org',
      registration_number: `REG-DISTSTATUS-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: ngo.id })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/claims/${claim.id}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receiver_first_name: 'Asha', receiver_general_area: 'Koramangala' }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.listing.status, 'delivered');

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(listingRow.status, 'delivered');
    assert.notStrictEqual(listingRow.status, 'distributed');
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('distributions').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
