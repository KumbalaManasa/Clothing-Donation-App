const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

async function createNgo(verificationStatus, label) {
  const email = `listings-open-${label}-${Date.now()}@example.com`;
  const [ngo] = await db('users')
    .insert({
      name: `Open Listings Test NGO ${label}`,
      email,
      phone: '+10000000032',
      role: 'ngo',
      org_name: `Org ${label}`,
      registration_number: `REG-OPEN-${label}-${Date.now()}`,
      verification_status: verificationStatus,
    })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });
  return { ngoId: ngo.id, token };
}

test('GET /listings/open with a not_verified NGO token returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const { ngoId, token } = await createNgo('not_verified', 'notverified');

  try {
    const res = await fetch(`http://localhost:${port}/listings/open`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 403);
  } finally {
    await db('users').where({ id: ngoId }).delete();
    server.close();
  }
});

test('GET /listings/open with a verified NGO token returns 200', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const { ngoId, token } = await createNgo('verified', 'verified');

  try {
    const res = await fetch(`http://localhost:${port}/listings/open`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(await res.json()));
  } finally {
    await db('users').where({ id: ngoId }).delete();
    server.close();
  }
});
