require('dotenv').config();

const { test, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const db = require('../src/db');
const { requireAuth } = require('../src/middleware/auth');
const { requireVerifiedNgo } = require('../src/middleware/requireVerifiedNgo');
const { signSessionToken } = require('../src/services/sessionToken');

function buildStubApp() {
  const app = express();
  app.get('/verified-ngo-only', requireAuth, requireVerifiedNgo, (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

after(async () => {
  await db.destroy();
});

test('requireVerifiedNgo: a not_verified NGO token hitting a verified-only stub route gets 403', async () => {
  const app = buildStubApp();
  const server = app.listen(0);
  const { port } = server.address();
  const email = `require-verified-ngo-notverified-${Date.now()}@example.com`;

  try {
    const [ngo] = await db('users')
      .insert({
        name: 'Not Verified Test NGO',
        email,
        phone: '+10000000018',
        role: 'ngo',
        org_name: 'Not Verified Org',
        registration_number: `REG-NOTVERIFIED-${Date.now()}`,
        verification_status: 'not_verified',
      })
      .returning(['id']);

    const token = signSessionToken({ id: ngo.id, role: 'ngo' });

    const res = await fetch(`http://localhost:${port}/verified-ngo-only`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.status, 403);
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});

test('requireVerifiedNgo: a verified NGO token hitting a verified-only stub route passes', async () => {
  const app = buildStubApp();
  const server = app.listen(0);
  const { port } = server.address();
  const email = `require-verified-ngo-verified-${Date.now()}@example.com`;

  try {
    const [ngo] = await db('users')
      .insert({
        name: 'Verified Test NGO',
        email,
        phone: '+10000000019',
        role: 'ngo',
        org_name: 'Verified Org',
        registration_number: `REG-VERIFIED-${Date.now()}`,
        verification_status: 'verified',
      })
      .returning(['id']);

    const token = signSessionToken({ id: ngo.id, role: 'ngo' });

    const res = await fetch(`http://localhost:${port}/verified-ngo-only`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(body, { ok: true });
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});
