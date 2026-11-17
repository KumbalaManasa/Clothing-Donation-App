require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { requireAuth } = require('../src/middleware/auth');
const { requireRole } = require('../src/middleware/role');
const { signSessionToken } = require('../src/services/sessionToken');

function buildStubApp() {
  const app = express();
  app.get('/ngo-only', requireAuth, requireRole('ngo'), (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

test('requireRole: a donor token hitting an NGO-only stub route gets 403', async () => {
  const app = buildStubApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(`http://localhost:${port}/ngo-only`, {
      headers: { Authorization: `Bearer ${donorToken}` },
    });

    assert.strictEqual(res.status, 403);
  } finally {
    server.close();
  }
});

test('requireRole: an NGO token hitting an NGO-only stub route passes', async () => {
  const app = buildStubApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const ngoToken = signSessionToken({ id: 'ngo-1', role: 'ngo' });

    const res = await fetch(`http://localhost:${port}/ngo-only`, {
      headers: { Authorization: `Bearer ${ngoToken}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(body, { ok: true });
  } finally {
    server.close();
  }
});
