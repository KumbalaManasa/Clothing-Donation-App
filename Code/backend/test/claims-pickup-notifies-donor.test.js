const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /claims/:id/pickup creates a picked_up notification for the donor', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Pickup Notify Test Donor',
      email: `claims-pickup-notify-donor-${Date.now()}@example.com`,
      phone: '+10000000051',
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
      name: 'Pickup Notify Test NGO',
      email: `claims-pickup-notify-ngo-${Date.now()}@example.com`,
      phone: '+10000000052',
      role: 'ngo',
      org_name: 'Pickup Notify Org',
      registration_number: `REG-PICKUPNOTIFY-${Date.now()}`,
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

    const notifications = await db('notifications').where({
      user_id: donor.id,
      listing_id: listing.id,
      type: 'picked_up',
    });
    assert.strictEqual(notifications.length, 1);
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
