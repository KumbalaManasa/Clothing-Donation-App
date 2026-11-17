const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');

after(async () => {
  await db.destroy();
});

const PASSWORD = 'correct-horse-battery-staple';

async function signupDonor(port, label) {
  const email = `pwreset-${label}-${Date.now()}-${Math.random()}@example.com`;
  await fetch(`http://localhost:${port}/auth/signup/donor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `PW Reset ${label}`, email, phone: '+10000000600', password: PASSWORD }),
  });
  return email;
}

async function login(port, email, password) {
  return fetch(`http://localhost:${port}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

async function cleanupByEmail(email) {
  const user = await db('users').where({ email }).first();
  if (user) {
    await db('password_resets').where({ user_id: user.id }).delete();
    await db('users').where({ id: user.id }).delete();
  }
}

test('POST /auth/forgot-password returns the same generic message for an unknown email, no dev fields', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no-such-account@example.com', method: 'code' }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.ok(body.message);
    assert.strictEqual('dev_code' in body, false);
    assert.strictEqual('dev_reset_link' in body, false);
  } finally {
    server.close();
  }
});

test('POST /auth/forgot-password rejects an unknown method', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = await signupDonor(port, 'badmethod');
  try {
    const res = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'carrier-pigeon' }),
    });
    assert.strictEqual(res.status, 400);
  } finally {
    await cleanupByEmail(email);
    server.close();
  }
});

test('code method: full round trip resets the password, old password stops working, code cannot be reused', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = await signupDonor(port, 'codeflow');

  try {
    const forgotRes = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'code' }),
    });
    const forgotBody = await forgotRes.json();
    assert.strictEqual(forgotRes.status, 200);
    assert.match(forgotBody.dev_code, /^\d{6}$/);

    const wrongRes = await fetch(`http://localhost:${port}/auth/reset-password/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: '000000', new_password: 'irrelevant' }),
    });
    assert.strictEqual(wrongRes.status, 400);

    const newPassword = 'a-brand-new-password';
    const rightRes = await fetch(`http://localhost:${port}/auth/reset-password/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: forgotBody.dev_code, new_password: newPassword }),
    });
    assert.strictEqual(rightRes.status, 200);

    const oldLoginRes = await login(port, email, PASSWORD);
    assert.strictEqual(oldLoginRes.status, 401, 'the original password must no longer work');

    const newLoginRes = await login(port, email, newPassword);
    assert.strictEqual(newLoginRes.status, 200, 'the new password must work');

    const reuseRes = await fetch(`http://localhost:${port}/auth/reset-password/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: forgotBody.dev_code, new_password: 'yet-another-password' }),
    });
    assert.strictEqual(reuseRes.status, 400, 'a used code must not work a second time');
  } finally {
    await cleanupByEmail(email);
    server.close();
  }
});

test('code method: an expired code is rejected', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = await signupDonor(port, 'codeexpired');

  try {
    const forgotRes = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'code' }),
    });
    const { dev_code: devCode } = await forgotRes.json();

    const user = await db('users').where({ email }).first();
    await db('password_resets')
      .where({ user_id: user.id, method: 'code' })
      .update({ expires_at: db.raw("now() - interval '1 minute'") });

    const res = await fetch(`http://localhost:${port}/auth/reset-password/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: devCode, new_password: 'does-not-matter' }),
    });
    assert.strictEqual(res.status, 400);
  } finally {
    await cleanupByEmail(email);
    server.close();
  }
});

test('a fresh forgot-password request supersedes an earlier outstanding code', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = await signupDonor(port, 'supersede');

  try {
    const firstRes = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'code' }),
    });
    const { dev_code: firstCode } = await firstRes.json();

    const secondRes = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'code' }),
    });
    const { dev_code: secondCode } = await secondRes.json();

    const oldCodeAttempt = await fetch(`http://localhost:${port}/auth/reset-password/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: firstCode, new_password: 'irrelevant' }),
    });
    assert.strictEqual(oldCodeAttempt.status, 400, 'the superseded first code must no longer work');

    const newCodeAttempt = await fetch(`http://localhost:${port}/auth/reset-password/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: secondCode, new_password: 'a-new-password-here' }),
    });
    assert.strictEqual(newCodeAttempt.status, 200, 'the latest code must work');
  } finally {
    await cleanupByEmail(email);
    server.close();
  }
});

test('link method: full round trip resets the password via the token in the dev_reset_link', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = await signupDonor(port, 'linkflow');

  try {
    const forgotRes = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'link' }),
    });
    const { dev_reset_link: devLink } = await forgotRes.json();
    assert.ok(devLink.includes('/reset-password?token='));
    const token = new URL(devLink).searchParams.get('token');

    const wrongRes = await fetch(`http://localhost:${port}/auth/reset-password/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'not-the-right-token', new_password: 'irrelevant' }),
    });
    assert.strictEqual(wrongRes.status, 400);

    const newPassword = 'reset-via-link-password';
    const rightRes = await fetch(`http://localhost:${port}/auth/reset-password/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    assert.strictEqual(rightRes.status, 200);

    const newLoginRes = await login(port, email, newPassword);
    assert.strictEqual(newLoginRes.status, 200);

    const reuseRes = await fetch(`http://localhost:${port}/auth/reset-password/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: 'another-password' }),
    });
    assert.strictEqual(reuseRes.status, 400, 'a used link token must not work a second time');
  } finally {
    await cleanupByEmail(email);
    server.close();
  }
});

test('link method: an expired token is rejected', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = await signupDonor(port, 'linkexpired');

  try {
    const forgotRes = await fetch(`http://localhost:${port}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, method: 'link' }),
    });
    const { dev_reset_link: devLink } = await forgotRes.json();
    const token = new URL(devLink).searchParams.get('token');

    const user = await db('users').where({ email }).first();
    await db('password_resets')
      .where({ user_id: user.id, method: 'link' })
      .update({ expires_at: db.raw("now() - interval '1 minute'") });

    const res = await fetch(`http://localhost:${port}/auth/reset-password/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: 'does-not-matter' }),
    });
    assert.strictEqual(res.status, 400);
  } finally {
    await cleanupByEmail(email);
    server.close();
  }
});
