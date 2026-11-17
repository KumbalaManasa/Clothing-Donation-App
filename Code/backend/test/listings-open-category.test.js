const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /listings/open?category excludes listings whose items don\'t match', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Category Test Donor',
      email: `listings-open-category-donor-${Date.now()}@example.com`,
      phone: '+10000000035',
      role: 'donor',
    })
    .returning(['id']);

  const [shirtListing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  await db('listing_items').insert({
    listing_id: shirtListing.id,
    category: 'Shirt',
    condition: 'Good',
    photo_url: 'https://example.com/shirt.jpg',
  });

  const [jacketListing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  await db('listing_items').insert({
    listing_id: jacketListing.id,
    category: 'Jacket',
    condition: 'Fair',
    photo_url: 'https://example.com/jacket.jpg',
  });

  const [ngo] = await db('users')
    .insert({
      name: 'Category Test NGO',
      email: `listings-open-category-ngo-${Date.now()}@example.com`,
      phone: '+10000000036',
      role: 'ngo',
      org_name: 'Category Org',
      registration_number: `REG-CATEGORY-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/listings/open?category=Shirt`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const ids = body.map((l) => l.id);

    assert.ok(ids.includes(shirtListing.id), 'listing with a matching item category must be included');
    assert.ok(!ids.includes(jacketListing.id), "listing without a matching item category must be excluded");
  } finally {
    await db('listing_items').whereIn('listing_id', [shirtListing.id, jacketListing.id]).delete();
    await db('listings').whereIn('id', [shirtListing.id, jacketListing.id]).delete();
    await db('users').where({ id: donor.id }).delete();
    await db('users').where({ id: ngo.id }).delete();
    server.close();
  }
});
