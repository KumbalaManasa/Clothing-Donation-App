const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { runClaimExpirySweep } = require('../src/jobs/claimExpiryJob');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('a listing reverted by claim expiry reappears in GET /listings/open', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Reappear Test Donor',
      email: `claim-expiry-reappear-donor-${Date.now()}@example.com`,
      phone: '+10000000074',
      role: 'donor',
    })
    .returning(['id']);
  const [claimingNgo] = await db('users')
    .insert({
      name: 'Reappear Test Claiming NGO',
      email: `claim-expiry-reappear-claimer-${Date.now()}@example.com`,
      phone: '+10000000075',
      role: 'ngo',
      org_name: 'Reappear Claiming Org',
      registration_number: `REG-REAPPEAR-CLAIMER-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [browsingNgo] = await db('users')
    .insert({
      name: 'Reappear Test Browsing NGO',
      email: `claim-expiry-reappear-browser-${Date.now()}@example.com`,
      phone: '+10000000076',
      role: 'ngo',
      org_name: 'Reappear Browsing Org',
      registration_number: `REG-REAPPEAR-BROWSER-${Date.now()}`,
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
      ngo_id: claimingNgo.id,
      status: 'active',
      expires_at: db.raw("now() - interval '1 hour'"),
    })
    .returning(['id']);
  const browsingToken = signSessionToken({ id: browsingNgo.id, role: 'ngo' });

  try {
    await runClaimExpirySweep();

    const res = await fetch(`http://localhost:${port}/listings/open`, {
      headers: { Authorization: `Bearer ${browsingToken}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const ids = body.map((l) => l.id);
    assert.ok(ids.includes(listing.id), 'the reverted listing must reappear in the open browse results');
  } finally {
    await db('notifications').where({ listing_id: listing.id }).delete();
    await db('claims').where({ id: claim.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, claimingNgo.id, browsingNgo.id]).delete();
    server.close();
  }
});
