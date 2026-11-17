const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /claims/:id/pickup sets picked_up_at and transitions the listing to picked_up atomically', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Pickup Status Test Donor',
      email: `claims-pickup-status-donor-${Date.now()}@example.com`,
      phone: '+10000000049',
      role: 'donor',
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
  const [ngo] = await db('users')
    .insert({
      name: 'Pickup Status Test NGO',
      email: `claims-pickup-status-ngo-${Date.now()}@example.com`,
      phone: '+10000000050',
      role: 'ngo',
      org_name: 'Pickup Status Org',
      registration_number: `REG-PICKUPSTATUS-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: ngo.id })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/claims/${claim.id}/pickup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 200);

    const claimRow = await db('claims').where({ id: claim.id }).first();
    assert.ok(claimRow.picked_up_at, 'picked_up_at should be set');

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(listingRow.status, 'picked_up');
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
