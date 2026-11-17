const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /notifications puts unread notifications before read ones, regardless of created_at', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Notifications Order Test Donor',
      email: `notifications-order-donor-${Date.now()}@example.com`,
      phone: '+10000000081',
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

  // Newer, but already read.
  const [readNotification] = await db('notifications')
    .insert({
      user_id: donor.id,
      listing_id: listing.id,
      type: 'claimed',
      message: 'Newer but read',
      read: true,
      created_at: db.fn.now(),
    })
    .returning(['id']);
  // Older, but still unread.
  const [unreadNotification] = await db('notifications')
    .insert({
      user_id: donor.id,
      listing_id: listing.id,
      type: 'picked_up',
      message: 'Older but unread',
      read: false,
      created_at: db.raw("now() - interval '1 hour'"),
    })
    .returning(['id']);

  const token = signSessionToken({ id: donor.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.length, 2);
    assert.strictEqual(body[0].id, unreadNotification.id, 'the unread (but older) notification must come first');
    assert.strictEqual(body[1].id, readNotification.id, 'the read (but newer) notification must come second');
  } finally {
    await db('notifications').whereIn('id', [readNotification.id, unreadNotification.id]).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').where({ id: donor.id }).delete();
    server.close();
  }
});
