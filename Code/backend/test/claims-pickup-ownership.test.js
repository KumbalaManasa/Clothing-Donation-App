const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /claims/:id/pickup by an NGO that does not own the claim returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Pickup Ownership Test Donor',
      email: `claims-pickup-ownership-donor-${Date.now()}@example.com`,
      phone: '+10000000046',
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
  const [owningNgo] = await db('users')
    .insert({
      name: 'Owning NGO',
      email: `claims-pickup-ownership-owner-${Date.now()}@example.com`,
      phone: '+10000000047',
      role: 'ngo',
      org_name: 'Owning Org',
      registration_number: `REG-PICKUP-OWNER-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [otherNgo] = await db('users')
    .insert({
      name: 'Other NGO',
      email: `claims-pickup-ownership-other-${Date.now()}@example.com`,
      phone: '+10000000048',
      role: 'ngo',
      org_name: 'Other Org',
      registration_number: `REG-PICKUP-OTHER-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: owningNgo.id })
    .returning(['id']);

  const otherToken = signSessionToken({ id: otherNgo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/claims/${claim.id}/pickup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    assert.strictEqual(res.status, 403);
  } finally {
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, owningNgo.id, otherNgo.id]).delete();
    server.close();
  }
});
