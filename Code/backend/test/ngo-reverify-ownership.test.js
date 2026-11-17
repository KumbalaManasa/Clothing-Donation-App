const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /ngo/:id/reverify without auth returns 401', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/ngo/00000000-0000-0000-0000-000000000000/reverify`, {
      method: 'POST',
    });
    assert.strictEqual(res.status, 401);
  } finally {
    server.close();
  }
});

test('POST /ngo/:id/reverify by an NGO that is not the account owner returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [targetNgo] = await db('users')
    .insert({
      name: 'Target NGO',
      email: `ngo-reverify-ownership-target-${Date.now()}@example.com`,
      phone: '+10000000016',
      role: 'ngo',
      org_name: 'Target Org',
      registration_number: `REG-REVERIFY-TARGET-${Date.now()}`,
      verification_status: 'not_verified',
    })
    .returning(['id']);
  const [otherNgo] = await db('users')
    .insert({
      name: 'Other NGO',
      email: `ngo-reverify-ownership-other-${Date.now()}@example.com`,
      phone: '+10000000017',
      role: 'ngo',
      org_name: 'Other Org',
      registration_number: `REG-REVERIFY-OTHER-${Date.now()}`,
      verification_status: 'not_verified',
    })
    .returning(['id']);

  const otherToken = signSessionToken({ id: otherNgo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/ngo/${targetNgo.id}/reverify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.strictEqual(res.status, 403);

    const row = await db('users').where({ id: targetNgo.id }).first();
    assert.strictEqual(row.verification_status, 'not_verified');
  } finally {
    await db('users').whereIn('id', [targetNgo.id, otherNgo.id]).delete();
    server.close();
  }
});

test('POST /ngo/:id/reverify by a donor returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Reverify Ownership Donor',
      email: `ngo-reverify-ownership-donor-${Date.now()}@example.com`,
      phone: '+10000000018',
      role: 'donor',
    })
    .returning(['id']);

  const donorToken = signSessionToken({ id: donor.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/ngo/${donor.id}/reverify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorToken}` },
    });
    assert.strictEqual(res.status, 403);
  } finally {
    await db('users').where({ id: donor.id }).delete();
    server.close();
  }
});
