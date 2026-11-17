const { test, after } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const { runClaimExpirySweep } = require('../src/jobs/claimExpiryJob');

after(async () => {
  await db.destroy();
});

test('running the claim expiry sweep twice back-to-back does not double-process or double-notify', async () => {
  const [donor] = await db('users')
    .insert({
      name: 'Idempotent Sweep Test Donor',
      email: `claim-expiry-idempotent-donor-${Date.now()}@example.com`,
      phone: '+10000000077',
      role: 'donor',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Idempotent Sweep Test NGO',
      email: `claim-expiry-idempotent-ngo-${Date.now()}@example.com`,
      phone: '+10000000078',
      role: 'ngo',
      org_name: 'Idempotent Sweep Org',
      registration_number: `REG-IDEMPOTENT-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'claimed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({
      listing_id: listing.id,
      ngo_id: ngo.id,
      status: 'active',
      expires_at: db.raw("now() - interval '1 hour'"),
    })
    .returning(['id']);

  try {
    await runClaimExpirySweep();
    await runClaimExpirySweep();

    const notifications = await db('notifications').where({ listing_id: listing.id, type: 'expired' });
    assert.strictEqual(notifications.length, 2, 'exactly one notification per party, not doubled');

    const claimRow = await db('claims').where({ id: claim.id }).first();
    assert.strictEqual(claimRow.status, 'expired');

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(listingRow.status, 'listed');
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
  }
});
