const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

async function setup(label) {
  const [owner] = await db('users')
    .insert({
      name: `Mark Read Test Owner ${label}`,
      email: `notifications-mark-read-owner-${label}-${Date.now()}@example.com`,
      phone: '+10000000082',
      role: 'donor',
    })
    .returning(['id']);
  const [other] = await db('users')
    .insert({
      name: `Mark Read Test Other ${label}`,
      email: `notifications-mark-read-other-${label}-${Date.now()}@example.com`,
      phone: '+10000000083',
      role: 'donor',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: owner.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [notification] = await db('notifications')
    .insert({
      user_id: owner.id,
      listing_id: listing.id,
      type: 'claimed',
      message: 'Test notification',
      read: false,
    })
    .returning(['id']);

  return { owner, other, listing, notification };
}

async function cleanup(ctx) {
  await db('notifications').where({ id: ctx.notification.id }).delete();
  await db('listings').where({ id: ctx.listing.id }).delete();
  await db('users').whereIn('id', [ctx.owner.id, ctx.other.id]).delete();
}

test('POST /notifications/:id/read by a non-owner returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setup('nonowner');
  const otherToken = signSessionToken({ id: ctx.other.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/notifications/${ctx.notification.id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    assert.strictEqual(res.status, 403);

    const row = await db('notifications').where({ id: ctx.notification.id }).first();
    assert.strictEqual(row.read, false, 'read must remain false when a non-owner attempts it');
  } finally {
    await cleanup(ctx);
    server.close();
  }
});

test('POST /notifications/:id/read by the owner succeeds and persists read=true', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setup('owner');
  const ownerToken = signSessionToken({ id: ctx.owner.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/notifications/${ctx.notification.id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.read, true);

    const row = await db('notifications').where({ id: ctx.notification.id }).first();
    assert.strictEqual(row.read, true);
  } finally {
    await cleanup(ctx);
    server.close();
  }
});
