const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

async function createDonorWithListing(label) {
  const email = `listings-mine-${label}-${Date.now()}@example.com`;
  const [donor] = await db('users')
    .insert({ name: `Mine Test Donor ${label}`, email, phone: '+10000000022', role: 'donor' })
    .returning(['id']);

  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: `${label}'s pickup spot`,
    })
    .returning(['id']);

  const token = signSessionToken({ id: donor.id, role: 'donor' });
  return { donorId: donor.id, listingId: listing.id, token };
}

async function cleanupDonor(donorId) {
  const listingIds = (await db('listings').where({ donor_id: donorId })).map((l) => l.id);
  if (listingIds.length) {
    await db('listing_items').whereIn('listing_id', listingIds).delete();
    await db('listings').whereIn('id', listingIds).delete();
  }
  await db('users').where({ id: donorId }).delete();
}

test('GET /listings/mine never returns another donor\'s listings', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const donorA = await createDonorWithListing('A');
  const donorB = await createDonorWithListing('B');

  try {
    const res = await fetch(`http://localhost:${port}/listings/mine`, {
      headers: { Authorization: `Bearer ${donorA.token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const ids = body.map((l) => l.id);

    assert.ok(ids.includes(donorA.listingId), "donor A's own listing should be present");
    assert.ok(!ids.includes(donorB.listingId), "donor B's listing must not appear in donor A's response");
  } finally {
    await cleanupDonor(donorA.donorId);
    await cleanupDonor(donorB.donorId);
    server.close();
  }
});
