const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /ngo/claims/mine includes each claim\'s listing_status and pickup_address_label', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Claims Mine Status Donor',
      email: `ngo-claims-mine-status-donor-${Date.now()}@example.com`,
      phone: '+10000000055',
      role: 'donor',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'picked_up',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Status Test Area',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Claims Mine Status NGO',
      email: `ngo-claims-mine-status-ngo-${Date.now()}@example.com`,
      phone: '+10000000056',
      role: 'ngo',
      org_name: 'Claims Mine Status Org',
      registration_number: `REG-CLAIMSMINE-STATUS-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: ngo.id, picked_up_at: db.fn.now() })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/ngo/claims/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const row = body.find((c) => c.id === claim.id);
    assert.ok(row, 'claim should be present');
    assert.strictEqual(row.listing_status, 'picked_up');
    assert.strictEqual(row.pickup_address_label, 'Status Test Area');
  } finally {
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
