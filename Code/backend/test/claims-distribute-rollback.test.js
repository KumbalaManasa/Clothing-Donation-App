const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /claims/:id/distribute rolls back fully if a write inside the transaction fails', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Distribute Rollback Test Donor',
      email: `claims-distribute-rollback-donor-${Date.now()}@example.com`,
      phone: '+10000000062',
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
      name: 'Distribute Rollback Test NGO',
      email: `claims-distribute-rollback-ngo-${Date.now()}@example.com`,
      phone: '+10000000063',
      role: 'ngo',
      org_name: 'Distribute Rollback Org',
      registration_number: `REG-DISTROLLBACK-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: ngo.id })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  // Pre-insert a distributions row for this same listing so the transaction's
  // own INSERT collides with the UNIQUE(listing_id) constraint (LLD §1.5),
  // simulating a write failure inside the transaction — before the listing
  // status transitions get a chance to run.
  const [existingDistribution] = await db('distributions')
    .insert({
      listing_id: listing.id,
      ngo_id: ngo.id,
      receiver_first_name: 'Pre-existing',
      receiver_general_area: 'Existing Area',
    })
    .returning(['id']);

  try {
    const res = await fetch(`http://localhost:${port}/claims/${claim.id}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receiver_first_name: 'Asha', receiver_general_area: 'Koramangala' }),
    });

    assert.notStrictEqual(res.status, 201, 'the request must not succeed');

    const distributions = await db('distributions').where({ listing_id: listing.id });
    assert.strictEqual(distributions.length, 1, 'no extra distribution row must have been created');
    assert.strictEqual(distributions[0].id, existingDistribution.id);

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(
      listingRow.status,
      'picked_up',
      'the listing must not be stuck at distributed — it must still be picked_up, unchanged',
    );
  } finally {
    await db('distributions').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
