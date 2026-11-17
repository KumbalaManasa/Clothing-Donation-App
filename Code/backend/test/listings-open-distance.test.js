const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

async function createDonor(label) {
  const email = `listings-open-distance-donor-${label}-${Date.now()}@example.com`;
  const [donor] = await db('users')
    .insert({ name: `Distance Test Donor ${label}`, email, phone: '+10000000033', role: 'donor' })
    .returning(['id']);
  return donor.id;
}

async function createListing(donorId, lat, lng, label) {
  const [listing] = await db('listings')
    .insert({
      donor_id: donorId,
      status: 'listed',
      pickup_lat: lat,
      pickup_lng: lng,
      pickup_address_label: label,
    })
    .returning(['id']);
  return listing.id;
}

test('GET /listings/open?lat&lng excludes far listings and sorts nearby ones nearest-first', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const donorId = await createDonor('distance');
  // Origin for the query.
  const originLat = 12.935;
  const originLng = 77.625;
  // ~0.11km from origin.
  const nearId = await createListing(donorId, 12.936, 77.625, 'Near');
  // ~1.1km from origin — farther than "near", still within default 15km radius.
  const midId = await createListing(donorId, 12.945, 77.625, 'Mid');
  // ~62km from origin — outside the default 15km radius.
  const farId = await createListing(donorId, 13.5, 77.625, 'Far');

  const [ngo] = await db('users')
    .insert({
      name: 'Distance Test NGO',
      email: `listings-open-distance-ngo-${Date.now()}@example.com`,
      phone: '+10000000034',
      role: 'ngo',
      org_name: 'Distance Org',
      registration_number: `REG-DISTANCE-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(
      `http://localhost:${port}/listings/open?lat=${originLat}&lng=${originLng}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const ids = body.map((l) => l.id);

    assert.ok(!ids.includes(farId), 'listing outside the radius must be excluded');
    assert.ok(ids.includes(nearId), 'nearby listing must be included');
    assert.ok(ids.includes(midId), 'mid-distance listing must be included');

    const nearIndex = ids.indexOf(nearId);
    const midIndex = ids.indexOf(midId);
    assert.ok(nearIndex < midIndex, 'nearer listing must be sorted before the farther one');
  } finally {
    await db('listings').whereIn('id', [nearId, midId, farId]).delete();
    await db('users').where({ id: donorId }).delete();
    await db('users').where({ id: ngo.id }).delete();
    server.close();
  }
});
