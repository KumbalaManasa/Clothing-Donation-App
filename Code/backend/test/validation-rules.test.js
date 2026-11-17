const { test, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

// Task 12.2 — the full LLD §5 validation-rule suite in one file: item
// requirements, cancellation reason, NGO signup fields, and receiver fields.
// Consolidates listings-create-items-validation.test.js (task 3.3),
// listings-cancel-reason.test.js (task 3.7), auth-signup-ngo.test.js's
// field-validation cases (task 2.3), and claims-distribute-receiver-fields.test.js
// (task 5.2) into one place. Each section below keeps its original test bodies
// unchanged — only the file they live in changed.

after(async () => {
  await db.destroy();
});

// --- Listing creation: >=1 item required (LLD §5, task 3.3) ---

test('POST /listings with an empty items[] returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ items: [], pickup_lat: 12.9, pickup_lng: 77.5 }),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});

test('POST /listings with items missing entirely returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const donorToken = signSessionToken({ id: 'donor-1', role: 'donor' });

    const res = await fetch(`http://localhost:${port}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${donorToken}` },
      body: JSON.stringify({ pickup_lat: 12.9, pickup_lng: 77.5 }),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});

// --- Cancellation: reason required (LLD §5, task 3.7) ---

test('POST /listings/:id/cancel without a reason returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const email = `validation-cancel-reason-${Date.now()}@example.com`;

  const [donor] = await db('users')
    .insert({ name: 'Cancel Reason Test Donor', email, phone: '+10000000023', role: 'donor' })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const token = signSessionToken({ id: donor.id, role: 'donor' });

  try {
    const res = await fetch(`http://localhost:${port}/listings/${listing.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    await db('listings').where({ id: listing.id }).delete();
    await db('users').where({ id: donor.id }).delete();
    server.close();
  }
});

// --- NGO signup: org_name + registration_number required (LLD §5, task 2.3) ---

function ngoSignupBaseBody(overrides) {
  return {
    name: 'Test NGO',
    email: `validation-ngo-signup-${Date.now()}-${Math.random()}@example.com`,
    phone: '+10000000010',
    password: 'correct-horse-battery-staple',
    org_name: 'Helping Hands',
    registration_number: `REG-${Date.now()}`,
    ...overrides,
  };
}

test('POST /auth/signup/ngo missing org_name returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const body = ngoSignupBaseBody();
    delete body.org_name;

    const res = await fetch(`http://localhost:${port}/auth/signup/ngo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});

test('POST /auth/signup/ngo missing registration_number returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const body = ngoSignupBaseBody();
    delete body.registration_number;

    const res = await fetch(`http://localhost:${port}/auth/signup/ngo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});

// --- Distribute: receiver_first_name + receiver_general_area required, photo optional (LLD §5, task 5.2) ---

async function setupDistributeContext(label) {
  const [donor] = await db('users')
    .insert({
      name: `Receiver Fields Test Donor ${label}`,
      email: `validation-distribute-donor-${label}-${Date.now()}@example.com`,
      phone: '+10000000058',
      role: 'donor',
    })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status: 'picked_up',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  const [ngo] = await db('users')
    .insert({
      name: `Receiver Fields Test NGO ${label}`,
      email: `validation-distribute-ngo-${label}-${Date.now()}@example.com`,
      phone: '+10000000059',
      role: 'ngo',
      org_name: `Receiver Fields Org ${label}`,
      registration_number: `REG-DISTFIELDS-${label}-${Date.now()}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: listing.id, ngo_id: ngo.id })
    .returning(['id']);
  const token = signSessionToken({ id: ngo.id, role: 'ngo' });

  return { donor, listing, ngo, claim, token };
}

async function cleanupDistributeContext(ctx) {
  await db('notifications').where({ listing_id: ctx.listing.id }).delete();
  await db('distributions').where({ listing_id: ctx.listing.id }).delete();
  await db('claims').where({ id: ctx.claim.id }).delete();
  await db('listings').where({ id: ctx.listing.id }).delete();
  await db('users').whereIn('id', [ctx.donor.id, ctx.ngo.id]).delete();
}

test('POST /claims/:id/distribute missing receiver_first_name returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setupDistributeContext('missingname');

  try {
    const res = await fetch(`http://localhost:${port}/claims/${ctx.claim.id}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ receiver_general_area: 'Koramangala' }),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    await cleanupDistributeContext(ctx);
    server.close();
  }
});

test('POST /claims/:id/distribute missing receiver_general_area returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setupDistributeContext('missingarea');

  try {
    const res = await fetch(`http://localhost:${port}/claims/${ctx.claim.id}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ receiver_first_name: 'Asha' }),
    });

    assert.strictEqual(res.status, 400);
  } finally {
    await cleanupDistributeContext(ctx);
    server.close();
  }
});

test('POST /claims/:id/distribute omitting photo entirely still succeeds past validation', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctx = await setupDistributeContext('nophoto');

  try {
    const res = await fetch(`http://localhost:${port}/claims/${ctx.claim.id}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ receiver_first_name: 'Asha', receiver_general_area: 'Koramangala' }),
    });

    assert.notStrictEqual(res.status, 400);
  } finally {
    await cleanupDistributeContext(ctx);
    server.close();
  }
});
