const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /listings/mine includes a non-empty delivery confirmation note for a delivered listing', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Confirmation Note Test Donor',
      email: `listings-mine-note-donor-${Date.now()}@example.com`,
      phone: '+10000000068',
      role: 'donor',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'delivered',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Confirmation Note Test NGO',
      email: `listings-mine-note-ngo-${Date.now()}@example.com`,
      phone: '+10000000069',
      role: 'ngo',
      org_name: 'Confirmation Note Org',
      registration_number: `REG-CONFIRMNOTE-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  await db('distributions').insert({
    listing_id: listing.id,
    ngo_id: ngo.id,
    receiver_first_name: 'Asha',
    receiver_general_area: 'Koramangala',
  });
  const donorToken = signSessionToken({ id: donor.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/listings/mine`, {
      headers: { Authorization: `Bearer ${donorToken}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const found = body.find((l) => l.id === listing.id);
    assert.ok(found, 'the delivered listing should be present');
    assert.strictEqual(typeof found.delivery_confirmation_note, 'string');
    assert.ok(found.delivery_confirmation_note.length > 0, 'confirmation note must be non-empty');
  } finally {
    await db('distributions').where({ listing_id: listing.id }).delete();
    await db('listings').where({ id: listing.id }).delete();
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
