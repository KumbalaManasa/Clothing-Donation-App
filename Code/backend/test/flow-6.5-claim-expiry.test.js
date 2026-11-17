const { test, after } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const { runClaimExpirySweep } = require('../src/jobs/claimExpiryJob');

// Task 12.4 — integration test for spec.md §6.5 "Claim Expiry": background
// job checks claims where now > expires_at and picked_up_at IS NULL; claim
// expires, listing reverts to Listed, NGO and donor notified. Renamed from
// claim-expiry-sweep.test.js (task 6.3) — same test, this is exactly the
// full core-flow walk that task already built.

after(async () => {
  await db.destroy();
});

test('runClaimExpirySweep expires a manually backdated claim in one run: claim expired, listing reverts to listed, both parties notified', async () => {
  const [donor] = await db('users')
    .insert({
      name: 'Expiry Sweep Test Donor',
      email: `flow-6.5-donor-${Date.now()}@example.com`,
      phone: '+10000000072',
      role: 'donor',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Expiry Sweep Test NGO',
      email: `flow-6.5-ngo-${Date.now()}@example.com`,
      phone: '+10000000073',
      role: 'ngo',
      org_name: 'Expiry Sweep Org',
      registration_number: `REG-EXPIRYSWEEP-${Date.now()}`,
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

    const claimRow = await db('claims').where({ id: claim.id }).first();
    assert.strictEqual(claimRow.status, 'expired');

    const listingRow = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(listingRow.status, 'listed');

    const notifications = await db('notifications').where({ listing_id: listing.id, type: 'expired' });
    const notifiedUserIds = notifications.map((n) => n.user_id).sort();
    assert.deepStrictEqual(notifiedUserIds, [donor.id, ngo.id].sort());
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
  }
});
