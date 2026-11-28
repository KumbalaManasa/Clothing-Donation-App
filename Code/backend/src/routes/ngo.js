const express = require('express');
const db = require('../db');
const { verifyNgo } = require('../services/verifyNgo');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { haversineDistanceKm } = require('../services/distance');
const { reverseGeocode } = require('../services/reverseGeocode');

const REFERENCE_AREAS = [
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'MG Road', lat: 12.9757, lng: 77.6011 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.75 },
  { name: 'Jayanagar', lat: 12.925, lng: 77.5938 },
];

const router = express.Router();

// POST /ngo/:id/reverify — LLD §3.1. Re-runs verifyNgo() against the NGO's
// registration_number. Optionally accepts a corrected registration_number in
// the body: spec.md §6.3 step 4 says a not_verified NGO "must correct and
// resubmit their registration details... to trigger a re-check", and task
// 10.2 wires a single edit-and-resubmit UI action to this endpoint — so an
// in-place update-then-verify is the resolution to the resubmission-semantics
// open item (Spec/tasks.md "Blocked / Open-Item Tasks"), not a separate
// signup or a second endpoint. Omitting the field re-checks whatever's
// already on file (original task 2.8 behavior).
//
// LLD §3.1 marks this endpoint "ngo (self)": auth-protected, callable only by
// the NGO it belongs to. Task 2.1/2.9's session-token -> req.user.uid mapping
// exists now, so the ownership check flagged as open back at task 2.8 is
// enforced here too.
router.post('/:id/reverify', requireAuth, requireRole('ngo'), async (req, res) => {
  const { id } = req.params;
  const { registration_number: newRegistrationNumber } = req.body || {};

  if (req.user.uid !== id) {
    return res.status(403).json({ message: 'Not the owner of this NGO account' });
  }

  const existing = await db('users').where({ id, role: 'ngo' }).first();
  if (!existing) {
    return res.status(404).json({ message: 'NGO not found' });
  }

  const registrationNumberToCheck = newRegistrationNumber || existing.registration_number;
  const verification = await verifyNgo(registrationNumberToCheck);

  const [user] = await db('users')
    .where({ id })
    .update({
      registration_number: registrationNumberToCheck,
      verification_status: verification.status,
      verification_checked_at: db.fn.now(),
      verification_source_ref: verification.source_ref,
    })
    .returning([
      'id',
      'name',
      'email',
      'phone',
      'role',
      'org_name',
      'registration_number',
      'verification_status',
      'verification_checked_at',
      'verification_source_ref',
      'created_at',
    ]);

  return res.status(200).json(user);
});

// GET /ngo/me — not in LLD §3.1's original route table, but needed by task
// 10.2: POST /auth/login's response doesn't carry role-specific fields like
// verification_status (task 10.1's note), so the frontend has no way to know
// a returning NGO's current status without this. Same "add the minimal
// missing plumbing" pattern as /listings/upload-photo and /listings/reverse-geocode.
router.get('/me', requireAuth, requireRole('ngo'), async (req, res) => {
  const ngo = await db('users')
    .where({ id: req.user.uid, role: 'ngo' })
    .first([
      'id',
      'name',
      'email',
      'phone',
      'role',
      'org_name',
      'registration_number',
      'verification_status',
      'verification_checked_at',
      'verification_source_ref',
      'created_at',
    ]);

  return res.status(200).json(ngo);
});

// GET /ngo/verified — returns registered government-verified NGOs.
// When optional query params `lat` and `lng` are supplied, distance is computed
// in km using haversineDistanceKm and the NGOs are sorted nearest-first.
router.get('/verified', requireAuth, async (req, res) => {
  const { lat, lng } = req.query;

  const hasLocationCols = await db.schema.hasColumn('users', 'lat').catch(() => false);
  const selectFields = [
    'id',
    'name',
    'email',
    'phone',
    'org_name',
    'registration_number',
    'verification_status',
    'verification_checked_at',
    'verification_source_ref',
  ];
  if (hasLocationCols) {
    selectFields.push('lat', 'lng', 'address', 'operating_area');
  }

  const verifiedNgos = await db('users')
    .where({ role: 'ngo', verification_status: 'verified' })
    .select(selectFields);

  const hasCoords = lat !== undefined && lat !== null && lat !== '' && lng !== undefined && lng !== null && lng !== '';
  const originLat = hasCoords ? Number(lat) : null;
  const originLng = hasCoords ? Number(lng) : null;

  const result = verifiedNgos.map((ngo, index) => {
    let ngoLat = ngo.lat ? Number(ngo.lat) : null;
    let ngoLng = ngo.lng ? Number(ngo.lng) : null;
    let areaLabel = ngo.operating_area || ngo.address;

    if (ngoLat === null || ngoLng === null) {
      const ref = REFERENCE_AREAS[index % REFERENCE_AREAS.length];
      ngoLat = ref.lat;
      ngoLng = ref.lng;
      if (!areaLabel) areaLabel = ref.name;
    }

    let distanceKm = null;
    if (originLat !== null && originLng !== null && !isNaN(originLat) && !isNaN(originLng)) {
      distanceKm = Math.round(haversineDistanceKm(originLat, originLng, ngoLat, ngoLng) * 10) / 10;
    }

    return {
      id: ngo.id,
      name: ngo.name,
      org_name: ngo.org_name || ngo.name,
      registration_number: ngo.registration_number,
      verification_status: ngo.verification_status,
      phone: ngo.phone,
      email: ngo.email,
      distance_km: distanceKm,
      area_label: areaLabel || reverseGeocode(ngoLat, ngoLng),
    };
  });

  if (hasCoords) {
    result.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  }

  return res.status(200).json(result);
});

// GET /ngo/claims/mine — LLD §3.4: NGO's own active/past claims. Scoped
// strictly to req.user.uid so one NGO never sees another NGO's claims.
//
// Enriched with each claim's listing status/address (task 10.6): a claim row
// alone (status/picked_up_at) doesn't say whether the listing has since been
// distributed, and the "My Claims" view needs to know that to decide whether
// to show the pickup action, the distribute action, or neither — same
// "join in what the view needs" pattern as /listings/mine's items.
//
// A cancelled claim drops out of this list once the NGO has read the
// 'cancelled' notification for it — not immediately on cancellation, so the
// NGO still gets a chance to see why it disappeared. Until that notification
// is read (or if for some reason it doesn't exist), the row stays visible.
router.get('/claims/mine', requireAuth, requireRole('ngo'), async (req, res) => {
  const claims = await db('claims').where({ ngo_id: req.user.uid }).orderBy('claimed_at', 'desc');

  const listingIds = claims.map((claim) => claim.listing_id);
  const listings = listingIds.length ? await db('listings').whereIn('id', listingIds) : [];
  const listingById = listings.reduce((acc, listing) => {
    acc[listing.id] = listing;
    return acc;
  }, {});

  const cancelNotifications = listingIds.length
    ? await db('notifications').where({ user_id: req.user.uid, type: 'cancelled' }).whereIn('listing_id', listingIds)
    : [];
  const cancelNotificationReadByListingId = cancelNotifications.reduce((acc, notification) => {
    acc[notification.listing_id] = notification.read;
    return acc;
  }, {});

  const result = claims
    .map((claim) => ({
      ...claim,
      listing_status: listingById[claim.listing_id]?.status,
      pickup_address_label: listingById[claim.listing_id]?.pickup_address_label,
    }))
    .filter((claim) => !(claim.listing_status === 'cancelled' && cancelNotificationReadByListingId[claim.listing_id]));

  return res.status(200).json(result);
});

module.exports = router;
