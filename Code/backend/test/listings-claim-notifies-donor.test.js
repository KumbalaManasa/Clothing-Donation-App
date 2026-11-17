const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /listings/:id/claim creates a claimed notification for the donor', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Claim Notify Test Donor',
      email: `listings-claim-notify-donor-${Date.now()}@example.com`,
      phone: '+10000000044',
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
      name: 'Claim Notify Test NGO',
      email: `listings-claim-notify-ngo-${Date.now()}@example.com`,
      phone: '+10000000045',
      role: 'ngo',
      org_name: 'Claim Notify Org',
      registration_number: `REG-CLAIMNOTIFY-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/listings/${listing.id}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 201);

    const notifications = await db('notifications').where({
      user_id: donor.id,
      listing_id: listing.id,
      type: 'claimed',
    });
    assert.strictEqual(notifications.length, 1);
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ listing_id: listing.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
