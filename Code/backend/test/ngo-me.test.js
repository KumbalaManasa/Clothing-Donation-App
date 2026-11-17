const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /ngo/me returns the authenticated NGO\'s own profile including verification_status', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [ngo] = await db('users')
    .insert({
      name: 'Me Test NGO',
      email: `ngo-me-test-${Date.now()}@example.com`,
      phone: '+10000000019',
      role: 'ngo',
      org_name: 'Me Org',
      registration_number: `REG-ME-${Date.now()}`,
      verification_status: 'not_verified',
    })
    .returning(['id']);

  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  try {
    const res = await fetch(`http://localhost:${port}/ngo/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.id, ngo.id);
    assert.strictEqual(body.org_name, 'Me Org');
    assert.strictEqual(body.verification_status, 'not_verified');
    assert.strictEqual(body.password_hash, undefined);
  } finally {
    await db('users').where({ id: ngo.id }).delete();
    server.close();
  }
});

test('GET /ngo/me by a donor returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [donor] = await db('users')
    .insert({
      name: 'Me Test Donor',
      email: `ngo-me-donor-${Date.now()}@example.com`,
      phone: '+10000000020',
      role: 'donor',
    })
    .returning(['id']);

  const token = signSessionToken({ id: donor.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/ngo/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 403);
  } finally {
    await db('users').where({ id: donor.id }).delete();
    server.close();
  }
});

test('GET /ngo/me without auth returns 401', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/ngo/me`);
    assert.strictEqual(res.status, 401);
  } finally {
    server.close();
  }
});
