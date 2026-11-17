const { test, after } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const { runClaimExpirySweep } = require('../src/jobs/claimExpiryJob');

after(async () => {
  await db.destroy();
});

test('a claim picked up just before the sweep runs is correctly excluded from expiry', async () => {
  const [donor] = await db('users')
    .insert({
      name: 'Excludes Picked Up Test Donor',
      email: `claim-expiry-excludes-donor-${Date.now()}@example.com`,
      phone: '+10000000079',
      role: 'donor',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Excludes Picked Up Test NGO',
      email: `claim-expiry-excludes-ngo-${Date.now()}@example.com`,
      phone: '+10000000080',
      role: 'ngo',
      org_name: 'Excludes Picked Up Org',
      registration_number: `REG-EXCLUDESPICKEDUP-${Date.now()}`,
      verification_status: 'verified',
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
  // expires_at is in the past (as if the job were about to sweep it), but
  // picked_up_at got set just before the job ran — this must exclude it.
  const [claim] = await db('claims')
    .insert({
      listing_id: listing.id,
      ngo_id: ngo.id,
      status: 'active',
      expires_at: db.raw("now() - interval '1 hour'"),
      picked_up_at: db.fn.now(),
    })
    .returning(['id']);

  try {
    await runClaimExpirySweep();

    const claimRow = await db('claims').where({ id: claim.id }).first();
    assert.strictEqual(claimRow.status, 'active', 'a picked-up claim must not be expired');

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(listingRow.status, 'picked_up', 'the listing must be untouched');

    const notifications = await db('notifications').where({ listing_id: listing.id, type: 'expired' });
    assert.strictEqual(notifications.length, 0, 'no expiry notifications should be sent');
  } finally {
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
  }
});
