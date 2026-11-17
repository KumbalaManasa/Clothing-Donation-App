const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /claims/:id/distribute creates both distributed and delivered notifications for the donor', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Distribute Notify Test Donor',
      email: `claims-distribute-notify-donor-${Date.now()}@example.com`,
      phone: '+10000000066',
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
      name: 'Distribute Notify Test NGO',
      email: `claims-distribute-notify-ngo-${Date.now()}@example.com`,
      phone: '+10000000067',
      role: 'ngo',
      org_name: 'Distribute Notify Org',
      registration_number: `REG-DISTNOTIFY-${Date.now()}`,
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

    assert.strictEqual(res.status, 201);

    const notifications = await db('notifications')
      .where({ user_id: donor.id, listing_id: listing.id })
      .orderBy('type');
    const types = notifications.map((n) => n.type).sort();

    assert.deepStrictEqual(types, ['delivered', 'distributed']);
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('distributions').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
