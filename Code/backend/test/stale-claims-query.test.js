const { test, after } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const { findStaleClaims } = require('../src/services/staleClaims');

after(async () => {
  await db.destroy();
});

async function createDonorAndNgo(label) {
  const [donor] = await db('users')
    .insert({
      name: `Stale Claims Test Donor ${label}`,
      email: `stale-claims-donor-${label}-${Date.now()}@example.com`,
      phone: '+10000000070',
      role: 'donor',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: `Stale Claims Test NGO ${label}`,
      email: `stale-claims-ngo-${label}-${Date.now()}@example.com`,
      phone: '+10000000071',
      role: 'ngo',
      org_name: `Stale Claims Org ${label}`,
      registration_number: `REG-STALECLAIMS-${label}-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  return { donorId: donor.id, ngoId: ngo.id };
}

async function createListing(donorId, status) {
  const [listing] = await db('listings')
    .insert({
      donor_id: donorId,
      status,
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  return listing.id;
}

test('findStaleClaims returns exactly the expired, active, not-yet-picked-up claims', async () => {
  const { donorId, ngoId } = await createDonorAndNgo('main');

  // 1. Stale: active, expired, never picked up — SHOULD be returned.
  const staleListingId = await createListing(donorId, 'claimed');
  const [staleClaim] = await db('claims')
    .insert({
      listing_id: staleListingId,
      ngo_id: ngoId,
      status: 'active',
      expires_at: db.raw("now() - interval '1 hour'"),
    })
    .returning(['id']);

  // 2. Not yet expired — must be excluded.
  const freshListingId = await createListing(donorId, 'claimed');
  await db('claims').insert({
    listing_id: freshListingId,
    ngo_id: ngoId,
    status: 'active',
    expires_at: db.raw("now() + interval '1 hour'"),
  });

  // 3. Expired but already picked up — must be excluded.
  const pickedUpListingId = await createListing(donorId, 'picked_up');
  await db('claims').insert({
    listing_id: pickedUpListingId,
    ngo_id: ngoId,
    status: 'active',
    expires_at: db.raw("now() - interval '1 hour'"),
    picked_up_at: db.fn.now(),
  });

  // 4. Expired but not active (already expired/cancelled) — must be excluded.
  const inactiveListingId = await createListing(donorId, 'listed');
  await db('claims').insert({
    listing_id: inactiveListingId,
    ngo_id: ngoId,
    status: 'expired',
    expires_at: db.raw("now() - interval '1 hour'"),
  });

  try {
    const staleClaims = await db.transaction((trx) => findStaleClaims(trx));
    const ids = staleClaims.map((c) => c.id);

    assert.deepStrictEqual(ids, [staleClaim.id]);
  } finally {
    await db('claims').where({ listing_id: staleListingId }).delete();
    await db('claims').where({ listing_id: freshListingId }).delete();
    await db('claims').where({ listing_id: pickedUpListingId }).delete();
    await db('claims').where({ listing_id: inactiveListingId }).delete();
    await db('listings')
      .whereIn('id', [staleListingId, freshListingId, pickedUpListingId, inactiveListingId])
      .delete();
    await db('users').whereIn('id', [donorId, ngoId]).delete();
  }
});
