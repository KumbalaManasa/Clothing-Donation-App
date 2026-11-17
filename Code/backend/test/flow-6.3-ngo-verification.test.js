const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

// Task 12.4 — integration test for spec.md §6.3 "NGO: Verification":
// 1. NGO signs up, submits org name, registration number, contact details.
// 2. System immediately queries the government verification source.
// 3. Match & approved -> verification_status=verified, can claim right away.
// 4. No match -> not_verified, blocked from claiming; no manual admin
//    fallback — NGO must correct and resubmit (reverify) to trigger a recheck.
// 5. Source unreachable (timeout) -> fails safe to not_verified.
// Consolidates auth-signup-ngo-verification.test.js (step 3),
// auth-signup-ngo-not-found.test.js (step 4a), auth-signup-ngo-timeout.test.js
// (step 5), and ngo-reverify.test.js (step 4b's correct-and-resubmit path) —
// tasks 2.5/2.6/2.7/2.8 — into one file.

after(async () => {
  await db.destroy();
});

test('POST /auth/signup/ngo with a known-good registration number returns verified in the response and the DB row', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `flow-6.3-verified-${Date.now()}@example.com`;
  const registrationNumber = `APPROVED-${Date.now()}`;

  try {
    const res = await fetch(`http://localhost:${port}/auth/signup/ngo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Verified Test NGO',
        email,
        phone: '+10000000012',
        password: 'correct-horse-battery-staple',
        org_name: 'Verified Org',
        registration_number: registrationNumber,
      }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.verification_status, 'verified');
    assert.ok(body.verification_source_ref);
    assert.ok(body.verification_checked_at);

    const row = await db('users').where({ email }).first();
    assert.ok(row, 'user row should exist in the database');
    assert.strictEqual(row.verification_status, 'verified');
    assert.ok(row.verification_source_ref);
    assert.ok(row.verification_checked_at);
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});

test('POST /auth/signup/ngo with an unrecognized registration number returns not_verified, never pending', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `flow-6.3-notfound-${Date.now()}@example.com`;
  const registrationNumber = `UNRECOGNIZED-${Date.now()}`;

  try {
    const res = await fetch(`http://localhost:${port}/auth/signup/ngo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Not Found Test NGO',
        email,
        phone: '+10000000013',
        password: 'correct-horse-battery-staple',
        org_name: 'Not Found Org',
        registration_number: registrationNumber,
      }),
    });
    const body = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.verification_status, 'not_verified');
    assert.notStrictEqual(body.verification_status, 'pending');
    assert.strictEqual(body.verification_source_ref, null);

    const row = await db('users').where({ email }).first();
    assert.ok(row, 'user row should exist in the database');
    assert.strictEqual(row.verification_status, 'not_verified');
    assert.notStrictEqual(row.verification_status, 'pending');
    assert.strictEqual(row.verification_source_ref, null);
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});

test('POST /auth/signup/ngo with a simulated verifyNgo timeout still completes signup with not_verified', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `flow-6.3-timeout-${Date.now()}@example.com`;
  const registrationNumber = `TIMEOUT-${Date.now()}`;

  try {
    const res = await fetch(`http://localhost:${port}/auth/signup/ngo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Timeout Test NGO',
        email,
        phone: '+10000000014',
        password: 'correct-horse-battery-staple',
        org_name: 'Timeout Org',
        registration_number: registrationNumber,
      }),
    });

    // Must not throw an unhandled error / hang — a clean HTTP response comes back.
    assert.strictEqual(res.status, 201);

    const body = await res.json();
    assert.strictEqual(body.verification_status, 'not_verified');
    assert.notStrictEqual(body.verification_status, null);
    assert.strictEqual(body.verification_source_ref, null);

    const row = await db('users').where({ email }).first();
    assert.ok(row, 'user row should exist in the database');
    assert.strictEqual(row.verification_status, 'not_verified');
    assert.notStrictEqual(row.verification_status, null);
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});

test('POST /ngo/:id/reverify flips a not_verified NGO to verified after its registration number is corrected', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `flow-6.3-reverify-${Date.now()}@example.com`;

  try {
    // Start out not_verified with a bad registration number (simulates step 4a's outcome).
    const [created] = await db('users')
      .insert({
        name: 'Reverify Test NGO',
        email,
        phone: '+10000000015',
        role: 'ngo',
        org_name: 'Reverify Org',
        registration_number: `UNRECOGNIZED-${Date.now()}`,
        verification_status: 'not_verified',
      })
      .returning(['id']);

    // Simulate the NGO correcting a typo in their registration number and
    // resubmitting (spec.md §6.3 step 4's "correct and resubmit" path).
    const goodRegistrationNumber = `APPROVED-${Date.now()}`;
    await db('users').where({ id: created.id }).update({ registration_number: goodRegistrationNumber });

    const token = signSessionToken({ id: created.id, role: 'ngo' });
    const res = await fetch(`http://localhost:${port}/ngo/${created.id}/reverify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.verification_status, 'verified');
    assert.ok(body.verification_source_ref);

    const row = await db('users').where({ id: created.id }).first();
    assert.strictEqual(row.verification_status, 'verified');
    assert.ok(row.verification_source_ref);
  } finally {
    await db('users').where({ email }).delete();
    server.close();
  }
});
