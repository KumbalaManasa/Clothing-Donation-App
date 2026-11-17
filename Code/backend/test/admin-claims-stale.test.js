const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /admin/claims/stale lists expired claims and excludes active ones', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Admin Stale Claims Test Donor',
      email: `admin-stale-claims-donor-${Date.now()}@example.com`,
      phone: '+10000000088',
      role: 'donor',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Admin Stale Claims Test NGO',
      email: `admin-stale-claims-ngo-${Date.now()}@example.com`,
      phone: '+10000000089',
      role: 'ngo',
      org_name: 'Admin Stale Claims Org',
      registration_number: `REG-ADMINSTALE-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);

  const [expiredListing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [expiredClaim] = await db('claims')
    .insert({ listing_id: expiredListing.id, ngo_id: ngo.id, status: 'expired' })
    .returning(['id']);

  const [activeListing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'claimed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [activeClaim] = await db('claims')
    .insert({ listing_id: activeListing.id, ngo_id: ngo.id, status: 'active' })
    .returning(['id']);

  const adminToken = signSessionToken({ id: 'admin-1', role: 'admin' });

  try {
    const res = await fetch(`http://localhost:${port}/admin/claims/stale`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const ids = body.map((c) => c.id);

    assert.ok(ids.includes(expiredClaim.id), 'the expired claim must appear');
    assert.ok(!ids.includes(activeClaim.id), 'the active claim must not appear');
  } finally {
    await db('claims').whereIn('id', [expiredClaim.id, activeClaim.id]).delete();
    await db('listings').whereIn('id', [expiredListing.id, activeListing.id]).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
