const { test, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const app = require('../index.js');
const db = require('../src/db');

after(async () => {
  await db.destroy();
});

test('POST /auth/login with valid credentials returns a usable session token', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `login-test-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';

  try {
    const signupRes = await fetch(`http://localhost:${port}/auth/signup/donor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Login Test Donor', email, phone: '+10000000016', password }),
    });
    assert.strictEqual(signupRes.status, 201);

    const loginRes = await fetch(`http://localhost:${port}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await loginRes.json();

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(typeof loginBody.token, 'string');
    assert.ok(loginBody.token.length > 0);
    assert.strictEqual(loginBody.user.email, email);
    assert.strictEqual('password_hash' in loginBody.user, false);

    // "Usable" — the token must actually decode/verify, not just be an opaque string.
    const decoded = jwt.verify(loginBody.token, process.env.JWT_SECRET);
    assert.strictEqual(decoded.role, 'donor');
    assert.ok(decoded.uid);
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});

test('POST /auth/login with wrong password returns 401', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `login-wrongpass-test-${Date.now()}@example.com`;

  try {
    const signupRes = await fetch(`http://localhost:${port}/auth/signup/donor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Login Wrong Pass Donor',
        email,
        phone: '+10000000017',
        password: 'the-real-password',
      }),
    });
    assert.strictEqual(signupRes.status, 201);

    const loginRes = await fetch(`http://localhost:${port}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'totally-wrong-password' }),
    });

    assert.strictEqual(loginRes.status, 401);
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});

test('POST /auth/login with an unknown email returns 401', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no-such-user@example.com', password: 'whatever' }),
    });

    assert.strictEqual(res.status, 401);
  } finally {
    server.close();
  }
});
