const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

// Task 12.4 — integration test for spec.md §6.6 "Admin: Moderation" step 1:
// view/remove listings that violate content guidelines. Renamed from
// admin-listings-delete.test.js (task 8.2) — same test, this is exactly the
// full core-flow walk that task already built.

after(async () => {
  await db.destroy();
});

test('DELETE /admin/listings/:id removes it from both the donor\'s and NGO\'s views', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Admin Delete Test Donor',
      email: `flow-6.6-donor-${Date.now()}@example.com`,
      phone: '+10000000086',
      role: 'donor',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: 'Admin Delete Test NGO',
      email: `flow-6.6-ngo-${Date.now()}@example.com`,
      phone: '+10000000087',
      role: 'ngo',
      org_name: 'Admin Delete Org',
      registration_number: `REG-ADMINDELETE-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);

  const donorToken = signSessionToken({ id: donor.id, role: 'donor' });
  const ngoToken = signSessionToken({ id: ngo.id, role: 'ngo' });
  const adminToken = signSessionToken({ id: 'admin-1', role: 'admin' });

  try {
    const deleteRes = await fetch(`http://localhost:${port}/admin/listings/${listing.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(deleteRes.status, 204);

    const mineRes = await fetch(`http://localhost:${port}/listings/mine`, {
      headers: { Authorization: `Bearer ${donorToken}` },
    });
    const mineBody = await mineRes.json();
    assert.ok(
      !mineBody.some((l) => l.id === listing.id),
      'deleted listing must not appear in the donor\'s own listings',
    );

    const openRes = await fetch(`http://localhost:${port}/listings/open`, {
      headers: { Authorization: `Bearer ${ngoToken}` },
    });
    const openBody = await openRes.json();
    assert.ok(
      !openBody.some((l) => l.id === listing.id),
      'deleted listing must not appear in the NGO\'s open browse view',
    );

    const row = await db('listings').where({ id: listing.id }).first();
    assert.strictEqual(row, undefined, 'the row must actually be gone from the database');
  } finally {
    await db('users').whereIn('id', [donor.id, ngo.id]).delete();
    server.close();
  }
});
