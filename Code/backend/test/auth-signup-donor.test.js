const test = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');

test('POST /auth/signup/donor creates a users row with role=donor and excludes password_hash from the response', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `donor-test-${Date.now()}@example.com`;

  try {
    const res = await fetch(`http://localhost:${port}/auth/signup/donor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Donor',
        email,
        phone: '+10000000009',
        password: 'correct-horse-battery-staple',
      }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.email, email);
    assert.strictEqual(body.role, 'donor');
    assert.strictEqual('password_hash' in body, false);
    assert.strictEqual('password' in body, false);

    const row = await db('users').where({ email }).first();
    assert.ok(row, 'user row should exist in the database');
    assert.strictEqual(row.role, 'donor');
    assert.notStrictEqual(row.password_hash, null);
    assert.notStrictEqual(row.password_hash, 'correct-horse-battery-staple');
  } finally {
    await db('users').where({ email }).delete();
    server.close();
    await db.destroy();
  }
});
