const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

// Task 12.4 — integration test for spec.md §6.1 "Donor: Create Listing":
// 1. Donor adds one or more items (photo, category, condition).
// 2. Donor sets pickup location via GPS pin (editable).
// 3. Listing is created with status Listed.
// Consolidates listings-create-persist.test.js, listings-create-address-label.test.js,
// and listings-create-role.test.js (tasks 3.2/3.4/3.5) into one file.

after(async () => {
  await db.destroy();
});

async function createDonorAndToken(label) {
  const email = `flow-6.1-${label}-${Date.now()}@example.com`;
  const [donor] = await db('users')
    .insert({ name: 'Create Flow Test Donor', email, phone: '+10000000020', role: 'donor' })
    .returning(['id']);
  const token = signSessionToken({ id: donor.id, role: 'donor' });
  return { donorId: donor.id, token };
}

async function cleanupDonor(donorId) {
  const listingIds = (await db('listings').where({ donor_id: donorId })).map((l) => l.id);
  if (listingIds.length) {
    await db('listing_items').whereIn('listing_id', listingIds).delete();
    await db('listings').whereIn('id', listingIds).delete();
  }
  await db('users').where({ id: donorId }).delete();
}

test('POST /listings with 3 items creates 1 listings row and 3 listing_items rows, committed together', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const { donorId, token } = await createDonorAndToken('success');

  try {
    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: [
          { category: 'Shirt', condition: 'Good', photo_url: 'https://example.com/1.jpg' },
          { category: 'Trousers', condition: 'Fair', photo_url: 'https://example.com/2.jpg' },
          { category: 'Jacket', condition: 'Good', photo_url: 'https://example.com/3.jpg' },
        ],
        pickup_lat: 12.9716,
        pickup_lng: 77.5946,
      }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.status, 'listed');

    const listingRows = await db('listings').where({ donor_id: donorId });
    assert.strictEqual(listingRows.length, 1);

    const itemRows = await db('listing_items').where({ listing_id: listingRows[0].id });
    assert.strictEqual(itemRows.length, 3);
  } finally {
    await cleanupDonor(donorId);
    server.close();
  }
});

test('POST /listings rolls back the listing row when an item insert fails mid-transaction', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const { donorId, token } = await createDonorAndToken('rollback');

  try {
    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: [
          { category: 'Shirt', condition: 'Good', photo_url: 'https://example.com/1.jpg' },
          // Missing category — violates listing_items.category NOT NULL (task 1.5),
          // simulating a mid-batch-insert failure.
          { category: null, condition: 'Fair', photo_url: 'https://example.com/2.jpg' },
          { category: 'Jacket', condition: 'Good', photo_url: 'https://example.com/3.jpg' },
        ],
        pickup_lat: 12.9716,
        pickup_lng: 77.5946,
      }),
    });

    assert.notStrictEqual(res.status, 201);

    const listingRows = await db('listings').where({ donor_id: donorId });
    assert.strictEqual(listingRows.length, 0, 'listing row must not persist when an item insert fails');

    const itemRows = await db('listing_items').whereIn(
      'listing_id',
      db('listings').select('id').where({ donor_id: donorId }),
    );
    assert.strictEqual(itemRows.length, 0, 'no item rows should persist either');
  } finally {
    await cleanupDonor(donorId);
    server.close();
  }
});

test('POST /listings auto-generates pickup_address_label from coordinates when not provided', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const { donorId, token } = await createDonorAndToken('auto-address');

  try {
    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: [{ category: 'Shirt', condition: 'Good', photo_url: 'https://example.com/1.jpg' }],
        pickup_lat: 12.9352,
        pickup_lng: 77.6245,
      }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.pickup_address_label, 'Koramangala');

    const row = await db('listings').where({ id: body.id }).first();
    assert.strictEqual(row.pickup_address_label, 'Koramangala');
  } finally {
    await cleanupDonor(donorId);
    server.close();
  }
});

test('POST /listings persists a donor-supplied pickup_address_label override instead of the auto value', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const { donorId, token } = await createDonorAndToken('override-address');

  try {
    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: [{ category: 'Shirt', condition: 'Good', photo_url: 'https://example.com/1.jpg' }],
        pickup_lat: 12.9352,
        pickup_lng: 77.6245,
        pickup_address_label: 'My Custom Pickup Spot',
      }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.pickup_address_label, 'My Custom Pickup Spot');
    assert.notStrictEqual(body.pickup_address_label, 'Koramangala');

    const row = await db('listings').where({ id: body.id }).first();
    assert.strictEqual(row.pickup_address_label, 'My Custom Pickup Spot');
  } finally {
    await cleanupDonor(donorId);
    server.close();
  }
});

test('POST /listings with a non-donor (NGO) token gets 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const ngoToken = signSessionToken({ id: 'ngo-1', role: 'ngo' });

    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ngoToken}` },
      body: JSON.stringify({ items: [], pickup_lat: 12.9, pickup_lng: 77.5 }),
    });

    assert.strictEqual(res.status, 403);
  } finally {
    server.close();
  }
});

test('POST /listings with a donor token passes the role gate', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ items: [], pickup_lat: 12.9, pickup_lng: 77.5 }),
    });

    assert.notStrictEqual(res.status, 403);
  } finally {
    server.close();
  }
});
