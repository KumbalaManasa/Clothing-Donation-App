const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

async function setup(status, label) {
  const [donor] = await db('users')
    .insert({
      name: `Distribute Test Donor ${label}`,
      email: `claims-distribute-donor-${label}-${Date.now()}@example.com`,
      phone: '+10000000055',
      role: 'donor',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status,
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [owningNgo] = await db('users')
    .insert({
      name: `Owning NGO ${label}`,
      email: `claims-distribute-owner-${label}-${Date.now()}@example.com`,
      phone: '+10000000056',
      role: 'ngo',
      org_name: `Owning Org ${label}`,
      registration_number: `REG-DISTOWNER-${label}-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [otherNgo] = await db('users')
    .insert({
      name: `Other NGO ${label}`,
      email: `claims-distribute-other-${label}-${Date.now()}@example.com`,
      phone: '+10000000057',
      role: 'ngo',
      org_name: `Other Org ${label}`,
      registration_number: `REG-DISTOTHER-${label}-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: owningNgo.id })
    .returning(['id']);

  return { donor, listing, owningNgo, otherNgo, claim };
}

async function cleanup(ctx) {
  await db('claims').where({ id: ctx.claim.id }).delete();
  await db('listings').where({ id: ctx.listing.id }).delete();
  await db('users').whereIn('id', [ctx.donor.id, ctx.owningNgo.id, ctx.otherNgo.id]).delete();
}

test('POST /claims/:id/distribute by a non-owning NGO returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setup('picked_up', 'wrongowner');
  const otherToken = signSessionToken({ id: ctx.otherNgo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/claims/${ctx.claim.id}/distribute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    assert.strictEqual(res.status, 403);
  } finally {
    await cleanup(ctx);
    server.close();
  }
});

test('POST /claims/:id/distribute when the listing is not picked_up returns 409', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setup('claimed', 'wrongstatus');
  const ownerToken = signSessionToken({ id: ctx.owningNgo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/claims/${ctx.claim.id}/distribute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    assert.strictEqual(res.status, 409);
  } finally {
    await cleanup(ctx);
    server.close();
  }
});
