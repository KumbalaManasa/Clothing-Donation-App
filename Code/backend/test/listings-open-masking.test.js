const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

async function setup(label) {
  const [donor] = await db('users')
    .insert({
      name: `Masking Test Donor ${label}`,
      email: `listings-open-masking-donor-${label}-${Date.now()}@example.com`,
      phone: '+10000000037',
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
      name: `Masking Test NGO ${label}`,
      email: `listings-open-masking-ngo-${label}-${Date.now()}@example.com`,
      phone: '+10000000038',
      role: 'ngo',
      org_name: 'Masking Org',
      registration_number: `REG-MASKING-${label}-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });
  return { donorId: donor.id, listingId: listing.id, ngoId: ngo.id, token };
}

async function cleanup({ donorId, listingId, ngoId }) {
  await db('listings').where({ id: listingId }).delete();
  await db('users').where({ id: donorId }).delete();
  await db('users').where({ id: ngoId }).delete();
}

test('GET /listings/open never includes pickup_lat/pickup_lng (no query params)', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setup('plain');

  try {
    const res = await fetch(`http://localhost:${port}/listings/open`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.ok(body.length > 0);
    for (const listing of body) {
      assert.strictEqual('pickup_lat' in listing, false);
      assert.strictEqual('pickup_lng' in listing, false);
    }
  } finally {
    await cleanup(ctx);
    server.close();
  }
});

test('GET /listings/open never includes pickup_lat/pickup_lng (with lat/lng query params)', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setup('withquery');

  try {
    const res = await fetch(`http://localhost:${port}/listings/open?lat=12.9&lng=77.5`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.ok(body.length > 0);
    for (const listing of body) {
      assert.strictEqual('pickup_lat' in listing, false);
      assert.strictEqual('pickup_lng' in listing, false);
    }
  } finally {
    await cleanup(ctx);
    server.close();
  }
});
