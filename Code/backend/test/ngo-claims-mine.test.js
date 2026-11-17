const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

async function createNgoWithClaim(label) {
  const email = `ngo-claims-mine-${label}-${Date.now()}@example.com`;
  const [donor] = await db('users')
    .insert({
      name: `Claims Mine Test Donor ${label}`,
      email: `ngo-claims-mine-donor-${label}-${Date.now()}@example.com`,
      phone: '+10000000053',
      role: 'donor',
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
  const [ngo] = await db('users')
    .insert({
      name: `Claims Mine Test NGO ${label}`,
      email,
      phone: '+10000000054',
      role: 'ngo',
      org_name: `Claims Mine Org ${label}`,
      registration_number: `REG-CLAIMSMINE-${label}-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: ngo.id })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });
  return { donorId: donor.id, listingId: listing.id, ngoId: ngo.id, claimId: claim.id, token };
}

async function cleanup(ctx) {
  await db('claims').where({ id: ctx.claimId }).delete();
  await db('listings').where({ id: ctx.listingId }).delete();
  await db('users').whereIn('id', [ctx.donorId, ctx.ngoId]).delete();
}

test('GET /ngo/claims/mine never returns another NGO\'s claims', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ngoA = await createNgoWithClaim('A');
  const ngoB = await createNgoWithClaim('B');

  try {
    const res = await fetch(`http://localhost:${port}/ngo/claims/mine`, {
      headers: { Authorization: `Bearer ${ngoA.token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const ids = body.map((c) => c.id);

    assert.ok(ids.includes(ngoA.claimId), "NGO A's own claim should be present");
    assert.ok(!ids.includes(ngoB.claimId), "NGO B's claim must not appear in NGO A's response");
  } finally {
    await cleanup(ngoA);
    await cleanup(ngoB);
    server.close();
  }
});
