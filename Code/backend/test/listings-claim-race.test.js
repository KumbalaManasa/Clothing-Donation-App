const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /listings/:id/claim: two concurrent claims on the same listing — exactly one succeeds, the other gets a clean 409', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Race Test Donor',
      email: `listings-claim-race-donor-${Date.now()}@example.com`,
      phone: '+10000000041',
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
  const [ngoA] = await db('users')
    .insert({
      name: 'Race Test NGO A',
      email: `listings-claim-race-ngoa-${Date.now()}@example.com`,
      phone: '+10000000042',
      role: 'ngo',
      org_name: 'Race Org A',
      registration_number: `REG-RACE-A-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [ngoB] = await db('users')
    .insert({
      name: 'Race Test NGO B',
      email: `listings-claim-race-ngob-${Date.now()}@example.com`,
      phone: '+10000000043',
      role: 'ngo',
      org_name: 'Race Org B',
      registration_number: `REG-RACE-B-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);

  const tokenA = signSessionToken({ id: ngoA.id, role: 'ngo' });
  const tokenB = signSessionToken({ id: ngoB.id, role: 'ngo' });

  try {
    const [resA, resB] = await Promise.all([
      fetch(`http://localhost:${port}/listings/${listing.id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      fetch(`http://localhost:${port}/listings/${listing.id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    assert.deepStrictEqual(statuses, [201, 409], 'exactly one 201 and one 409, no raw 500');

    const claims = await db('claims').where({ listing_id: listing.id });
    assert.strictEqual(claims.length, 1, 'exactly one claim row must exist');

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(listingRow.status, 'claimed');
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ listing_id: listing.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngoA.id, ngoB.id]).delete();
    server.close();
  }
});
