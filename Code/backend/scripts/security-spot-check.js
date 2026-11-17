// Task 12.8 — security spot-check: iterates every role-gated and
// ownership-gated endpoint in the app with the wrong actor and asserts each
// one rejects with 403 (spec.md §7's trust boundary: a donor can't touch NGO
// routes, one NGO can't touch another NGO's claim/account, and only admins
// reach /admin). Self-contained: creates its own fixtures against
// TEST_DATABASE_URL (same isolated database task 12.3's `npm test` harness
// uses), runs every check, cleans up, and exits non-zero if anything that
// should have been rejected wasn't.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('dotenv').config();

const app = require('../index.js');
const db = require('../src/db');
const { signSessionToken } = require('../src/services/sessionToken');

async function createFixtures() {
  const stamp = Date.now();

  const [donorA] = await db('users')
    .insert({ name: 'Spot-check Donor A', email: `spotcheck-donorA-${stamp}@example.com`, phone: '+10000000200', role: 'donor' })
    .returning(['id']);
  const [donorB] = await db('users')
    .insert({ name: 'Spot-check Donor B', email: `spotcheck-donorB-${stamp}@example.com`, phone: '+10000000201', role: 'donor' })
    .returning(['id']);
  const [ngoA] = await db('users')
    .insert({
      name: 'Spot-check NGO A',
      email: `spotcheck-ngoA-${stamp}@example.com`,
      phone: '+10000000202',
      role: 'ngo',
      org_name: 'Spot-check Org A',
      registration_number: `SPOTCHECK-A-${stamp}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [ngoB] = await db('users')
    .insert({
      name: 'Spot-check NGO B',
      email: `spotcheck-ngoB-${stamp}@example.com`,
      phone: '+10000000203',
      role: 'ngo',
      org_name: 'Spot-check Org B',
      registration_number: `SPOTCHECK-B-${stamp}`,
      verification_status: 'verified',
    })
    .returning(['id']);
  const [ngoNotVerified] = await db('users')
    .insert({
      name: 'Spot-check Not-Verified NGO',
      email: `spotcheck-ngoNV-${stamp}@example.com`,
      phone: '+10000000204',
      role: 'ngo',
      org_name: 'Spot-check Unverified Org',
      registration_number: `SPOTCHECK-NV-${stamp}`,
      verification_status: 'not_verified',
    })
    .returning(['id']);

  const [openListing] = await db('listings')
    .insert({
      donor_id: donorA.id,
      status: 'listed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Spot-check Listed Address',
    })
    .returning(['id']);
  const [claimedListing] = await db('listings')
    .insert({
      donor_id: donorA.id,
      status: 'claimed',
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Spot-check Claimed Address',
    })
    .returning(['id']);
  const [claim] = await db('claims')
    .insert({ listing_id: claimedListing.id, ngo_id: ngoA.id, status: 'active' })
    .returning(['id']);
  const [notification] = await db('notifications')
    .insert({ user_id: donorA.id, listing_id: openListing.id, type: 'claimed', message: 'Spot-check fixture' })
    .returning(['id']);

  return {
    donorA,
    donorB,
    ngoA,
    ngoB,
    ngoNotVerified,
    openListing,
    claimedListing,
    claim,
    notification,
    tokens: {
      donorA: signSessionToken({ id: donorA.id, role: 'donor' }),
      donorB: signSessionToken({ id: donorB.id, role: 'donor' }),
      ngoA: signSessionToken({ id: ngoA.id, role: 'ngo' }),
      ngoB: signSessionToken({ id: ngoB.id, role: 'ngo' }),
      ngoNotVerified: signSessionToken({ id: ngoNotVerified.id, role: 'ngo' }),
      // Role-only guards never look the admin row up in the DB (requireRole
      // just checks the token's role claim), so no admin user row is needed.
      unusedAdmin: signSessionToken({ id: 'spotcheck-admin', role: 'admin' }),
    },
  };
}

async function cleanupFixtures(f) {
  await db('notifications').where({ id: f.notification.id }).delete();
  await db('claims').where({ id: f.claim.id }).delete();
  await db('listings').whereIn('id', [f.openListing.id, f.claimedListing.id]).delete();
  await db('users').whereIn('id', [f.donorA.id, f.donorB.id, f.ngoA.id, f.ngoB.id, f.ngoNotVerified.id]).delete();
}

function buildChecks(f) {
  const t = f.tokens;
  return [
    // --- POST /listings, /listings/upload-photo, /listings/reverse-geocode, GET /listings/mine: donor-only ---
    { label: 'NGO on donor-only POST /listings', method: 'POST', path: '/listings', token: t.ngoA, body: { items: [], pickup_lat: 1, pickup_lng: 1 } },
    { label: 'NGO on donor-only POST /listings/upload-photo', method: 'POST', path: '/listings/upload-photo', token: t.ngoA, body: { photo: 'data:image/png;base64,AA==' } },
    { label: 'NGO on donor-only GET /listings/reverse-geocode', method: 'GET', path: '/listings/reverse-geocode?lat=1&lng=1', token: t.ngoA },
    { label: 'NGO on donor-only GET /listings/mine', method: 'GET', path: '/listings/mine', token: t.ngoA },

    // --- POST /listings/:id/cancel: donor role + owner ---
    { label: 'NGO on donor-only POST /listings/:id/cancel', method: 'POST', path: `/listings/${f.openListing.id}/cancel`, token: t.ngoA, body: { reason: 'x' } },
    { label: "Donor B on donor A's listing cancel (ownership)", method: 'POST', path: `/listings/${f.openListing.id}/cancel`, token: t.donorB, body: { reason: 'x' } },

    // --- GET /listings/open, POST /listings/:id/claim: verified-NGO-only ---
    { label: 'Donor on verified-NGO-only GET /listings/open', method: 'GET', path: '/listings/open', token: t.donorA },
    { label: 'Not-verified NGO on GET /listings/open', method: 'GET', path: '/listings/open', token: t.ngoNotVerified },
    { label: 'Donor on verified-NGO-only POST /listings/:id/claim', method: 'POST', path: `/listings/${f.openListing.id}/claim`, token: t.donorA },
    { label: 'Not-verified NGO on POST /listings/:id/claim', method: 'POST', path: `/listings/${f.openListing.id}/claim`, token: t.ngoNotVerified },

    // --- POST /claims/:id/pickup, /claims/:id/distribute: ngo role + claim owner ---
    { label: 'Donor on ngo-only POST /claims/:id/pickup', method: 'POST', path: `/claims/${f.claim.id}/pickup`, token: t.donorA },
    { label: "NGO B on NGO A's claim pickup (ownership)", method: 'POST', path: `/claims/${f.claim.id}/pickup`, token: t.ngoB },
    { label: 'Donor on ngo-only POST /claims/:id/distribute', method: 'POST', path: `/claims/${f.claim.id}/distribute`, token: t.donorA, body: { receiver_first_name: 'x', receiver_general_area: 'y' } },
    { label: "NGO B on NGO A's claim distribute (ownership)", method: 'POST', path: `/claims/${f.claim.id}/distribute`, token: t.ngoB, body: { receiver_first_name: 'x', receiver_general_area: 'y' } },

    // --- GET /ngo/me, POST /ngo/:id/reverify, GET /ngo/claims/mine: ngo-only (+ self for reverify) ---
    { label: 'Donor on ngo-only GET /ngo/me', method: 'GET', path: '/ngo/me', token: t.donorA },
    { label: 'Donor on ngo-only POST /ngo/:id/reverify', method: 'POST', path: `/ngo/${f.ngoA.id}/reverify`, token: t.donorA },
    { label: "NGO B on NGO A's own-account reverify (ownership)", method: 'POST', path: `/ngo/${f.ngoA.id}/reverify`, token: t.ngoB },
    { label: 'Donor on ngo-only GET /ngo/claims/mine', method: 'GET', path: '/ngo/claims/mine', token: t.donorA },

    // --- /admin/*: admin-only ---
    { label: 'Donor on admin-only GET /admin/listings', method: 'GET', path: '/admin/listings', token: t.donorA },
    { label: 'NGO on admin-only GET /admin/listings', method: 'GET', path: '/admin/listings', token: t.ngoA },
    { label: 'Donor on admin-only DELETE /admin/listings/:id', method: 'DELETE', path: `/admin/listings/${f.openListing.id}`, token: t.donorA },
    { label: 'Donor on admin-only GET /admin/claims/stale', method: 'GET', path: '/admin/claims/stale', token: t.donorA },
    { label: 'Donor on admin-only GET /admin/ngo-verifications', method: 'GET', path: '/admin/ngo-verifications', token: t.donorA },

    // --- POST /notifications/:id/read: owner-only ---
    { label: "Donor B marking donor A's notification read (ownership)", method: 'POST', path: `/notifications/${f.notification.id}/read`, token: t.donorB },
  ].map((check) => ({ ...check, expect: [403] }));
}

async function main() {
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://localhost:${port}`;

  const fixtures = await createFixtures();
  const checks = buildChecks(fixtures);

  const results = [];
  for (const check of checks) {
    const res = await fetch(`${base}${check.path}`, {
      method: check.method,
      headers: {
        'Content-Type': 'application/json',
        ...(check.token ? { Authorization: `Bearer ${check.token}` } : {}),
      },
      body: check.body !== undefined ? JSON.stringify(check.body) : undefined,
    });
    results.push({ ...check, actual: res.status, ok: check.expect.includes(res.status) });
  }

  await cleanupFixtures(fixtures);
  server.close();
  await db.destroy();

  for (const r of results) {
    const mark = r.ok ? '✔' : '✘';
    console.log(`${mark} ${r.method} ${r.path} — ${r.label} (expected ${r.expect.join('/')}, got ${r.actual})`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

  if (failed.length > 0) {
    console.error(`\n${failed.length} security check(s) FAILED — an endpoint above did not reject a wrong-role/wrong-owner request.`);
    process.exitCode = 1;
    return;
  }

  console.log('\nEvery role-gated and ownership-gated endpoint rejected the wrong actor correctly.');
}

main().catch((err) => {
  console.error('security-spot-check crashed:', err);
  process.exitCode = 1;
});
