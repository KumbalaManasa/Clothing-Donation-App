const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

after(async () => {
  await db.destroy();
});

test('GET /admin/listings with a non-admin token returns 403', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(`http://localhost:${port}/admin/listings`, {
      headers: { Authorization: `Bearer ${donorToken}` },
    });

    assert.strictEqual(res.status, 403);
  } finally {
    server.close();
  }
});

test('GET /admin/listings with an admin token returns 200', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const adminToken = signSessionToken({ id: 'admin-1', role: 'admin' });

    const res = await fetch(`http://localhost:${port}/admin/listings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(await res.json()));
  } finally {
    server.close();
  }
});
