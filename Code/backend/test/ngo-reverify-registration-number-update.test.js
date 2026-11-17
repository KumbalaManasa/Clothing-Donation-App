const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('POST /ngo/:id/reverify with a registration_number in the body updates it in place before verifying', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const [ngo] = await db('users')
    .insert({
      name: 'Resubmit Test NGO',
      email: `ngo-reverify-resubmit-${Date.now()}@example.com`,
      phone: '+10000000021',
      role: 'ngo',
      org_name: 'Resubmit Org',
      registration_number: `TYPO-${Date.now()}`,
      verification_status: 'not_verified',
    })
    .returning(['id']);

  const token = signSessionToken({ id: ngo.id, role: 'ngo' });
  const correctedNumber = `APPROVED-${Date.now()}`;

  try {
    const res = await fetch(`http://localhost:${port}/ngo/${ngo.id}/reverify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_number: correctedNumber }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.registration_number, correctedNumber);
    assert.strictEqual(body.verification_status, 'verified');

    const row = await db('users').where({ id: ngo.id }).first();
    assert.strictEqual(row.registration_number, correctedNumber);
    assert.strictEqual(row.verification_status, 'verified');
  } finally {
    await db('users').where({ id: ngo.id }).delete();
    server.close();
  }
});
