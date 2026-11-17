const { test, after } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const {
  transitionListingStatus,
  InvalidStatusTransitionError,
  ALLOWED_TRANSITIONS,
} = require('../src/services/listingStatusTransitions');

// Task 12.1 — the full status-transition state-machine suite (LLD §2) in one
// file: every valid transition row plus every illegal pair, consolidating
// what was previously split across listing-status-transitions-valid.test.js
// (task 4.2) and listing-status-transitions-invalid.test.js (task 4.3).

after(async () => {
  await db.destroy();
});

async function createListingWithStatus(status, label) {
  const email = `state-machine-${label}-${Date.now()}-${Math.random()}@example.com`;
  const [donor] = await db('users')
    .insert({ name: `State Machine Test Donor ${label}`, email, phone: '+10000000030', role: 'donor' })
    .returning(['id']);
  const [listing] = await db('listings')
    .insert({
      donor_id: donor.id,
      status,
      pickup_lat: 12.9,
      pickup_lng: 77.5,
      pickup_address_label: 'Test Area',
    })
    .returning(['id']);
  return { donorId: donor.id, listingId: listing.id };
}

async function cleanup(donorId, listingId) {
  await db('listings').where({ id: listingId }).delete();
  await db('users').where({ id: donorId }).delete();
}

const VALID_TRANSITIONS = [
  ['listed', 'claimed'],
  ['listed', 'cancelled'],
  ['claimed', 'picked_up'],
  ['claimed', 'cancelled'],
  ['claimed', 'listed'],
  ['picked_up', 'distributed'],
  ['distributed', 'delivered'],
];

for (const [from, to] of VALID_TRANSITIONS) {
  test(`transitionListingStatus allows '${from}' -> '${to}'`, async () => {
    const { donorId, listingId } = await createListingWithStatus(from, `valid-${from}-${to}`);

    try {
      const updated = await db.transaction((trx) => transitionListingStatus(trx, listingId, from, to));

      assert.strictEqual(updated.status, to);

      const row = await db('listings').where({ id: listingId }).first();
      assert.strictEqual(row.status, to);
    } finally {
      await cleanup(donorId, listingId);
    }
  });
}

// Every (from, to) pair not present in ALLOWED_TRANSITIONS — a thorough sweep
// rather than a hand-picked few, so nothing illegal slips through unnoticed.
// Covers the task's called-out examples (listed->picked_up skip,
// picked_up->cancelled, delivered->anything) plus every other illegal pair.
const ALL_STATUSES = Object.keys(ALLOWED_TRANSITIONS);
const ILLEGAL_TRANSITIONS = [];
for (const from of ALL_STATUSES) {
  for (const to of ALL_STATUSES) {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      ILLEGAL_TRANSITIONS.push([from, to]);
    }
  }
}

for (const [from, to] of ILLEGAL_TRANSITIONS) {
  test(`transitionListingStatus rejects illegal '${from}' -> '${to}'`, async () => {
    const { donorId, listingId } = await createListingWithStatus(from, `illegal-${from}-${to}`);

    try {
      await assert.rejects(
        () => db.transaction((trx) => transitionListingStatus(trx, listingId, from, to)),
        InvalidStatusTransitionError,
      );

      // Not a silent no-op — the row must be completely unchanged, not
      // partially updated or left in some other unexpected state.
      const row = await db('listings').where({ id: listingId }).first();
      assert.strictEqual(row.status, from);
    } finally {
      await cleanup(donorId, listingId);
    }
  });
}

// Task 12.9's CI sanity-check ("a deliberately broken transition rule fails
// CI") exposed a real blind spot in the dynamic sweep above: ILLEGAL_TRANSITIONS
// is *generated from* ALLOWED_TRANSITIONS, so it's tautological — incorrectly
// widening that map (e.g. adding 'picked_up' to listed's allowed targets)
// doesn't fail a test, it just silently stops generating one for that pair.
// These assertions are hardcoded straight from spec.md §4's pipeline order
// and LLD §2's table, independent of ALLOWED_TRANSITIONS, specifically so
// loosening that map can't silently make them pass.
const SPEC_ANCHORED_ILLEGAL_TRANSITIONS = [
  ['listed', 'picked_up'],
  ['listed', 'distributed'],
  ['listed', 'delivered'],
  ['claimed', 'distributed'],
  ['claimed', 'delivered'],
  ['picked_up', 'cancelled'],
  ['picked_up', 'listed'],
  ['delivered', 'listed'],
  ['delivered', 'claimed'],
  ['delivered', 'picked_up'],
  ['delivered', 'distributed'],
  ['delivered', 'cancelled'],
  ['cancelled', 'listed'],
];

for (const [from, to] of SPEC_ANCHORED_ILLEGAL_TRANSITIONS) {
  test(`spec-anchored: '${from}' -> '${to}' must never be legal, regardless of ALLOWED_TRANSITIONS`, async () => {
    const { donorId, listingId } = await createListingWithStatus(from, `spec-illegal-${from}-${to}`);

    try {
      await assert.rejects(
        () => db.transaction((trx) => transitionListingStatus(trx, listingId, from, to)),
        InvalidStatusTransitionError,
      );

      const row = await db('listings').where({ id: listingId }).first();
      assert.strictEqual(row.status, from);
    } finally {
      await cleanup(donorId, listingId);
    }
  });
}
