const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { requireVerifiedNgo } = require('../middleware/requireVerifiedNgo');
const { reverseGeocode } = require('../services/reverseGeocode');
const {
  transitionListingStatus,
  InvalidStatusTransitionError,
} = require('../services/listingStatusTransitions');
const { haversineDistanceKm } = require('../services/distance');
const { uploadImage, ImageValidationError } = require('../services/imageStorage');

const DEFAULT_OPEN_LISTINGS_RADIUS_KM = 15;

const router = express.Router();

// POST /listings/upload-photo — donor-only. Not itself an LLD §3.3 route;
// added for task 9.2 (frontend photo picker wiring) because POST /listings
// (task 3.4) was built expecting items[].photo_url already populated, which
// presumes a separate pre-upload step that hadn't actually been built yet.
// Thin wrapper around the configurable image storage seam (task 13A) the
// distribute endpoint also uses — local filesystem in dev, Cloudinary in
// production (IMAGE_STORAGE_DRIVER).
router.post('/upload-photo', requireAuth, requireRole('donor'), async (req, res) => {
  const { photo } = req.body || {};
  if (!photo) {
    return res.status(400).json({ message: 'photo is required' });
  }

  try {
    const photoUrl = await uploadImage(photo);
    return res.status(201).json({ photo_url: photoUrl });
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }
});

// GET /listings/reverse-geocode?lat&lng — donor-only. Not itself an LLD §3.3
// route; added for task 9.3 so the frontend can pre-fill the editable address
// field right after capturing GPS coordinates, before the listing is created
// (POST /listings, task 3.5, only reverse-geocodes as part of creating the
// row — there was no way to preview the label beforehand). Exposes the same
// reverseGeocode() service, no new geocoding logic.
router.get('/reverse-geocode', requireAuth, requireRole('donor'), async (req, res) => {
  const { lat, lng } = req.query;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  const addressLabel = reverseGeocode(Number(lat), Number(lng));
  return res.status(200).json({ address_label: addressLabel });
});

// POST /listings — LLD §3.3: donor-only. Role gate (task 3.2) and ≥1-item
// validation (task 3.3) run first; this adds the actual transactional
// persistence (task 3.4, LLD §1.2/§1.3): one listings row + one row per item,
// committed together or not at all.
//
// pickup_address_label: auto-generated via reverseGeocode() (task 3.5, LLD §5:
// "reverse-geocoded, editable"), but a donor-supplied label always wins when
// provided — this is the "editable before submit" override.
//
// items[].photo_url is expected pre-populated (already uploaded via the
// Cloudinary helper, task 3.1) — wiring a raw file through this endpoint isn't
// part of this task's scope.
router.post('/', requireAuth, requireRole('donor'), async (req, res) => {
  const { items, pickup_lat, pickup_lng, pickup_address_label } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items must be a non-empty array' });
  }

  const hasIncompleteItem = items.some((item) => !item?.category || !item?.condition || !item?.photo_url);
  if (hasIncompleteItem) {
    return res.status(400).json({ message: 'each item requires category, condition, and photo_url' });
  }

  if (pickup_lat === undefined || pickup_lat === null || pickup_lng === undefined || pickup_lng === null) {
    return res.status(400).json({ message: 'pickup_lat and pickup_lng are required' });
  }

  const addressLabel = pickup_address_label || reverseGeocode(pickup_lat, pickup_lng);

  const listing = await db.transaction(async (trx) => {
    const [createdListing] = await trx('listings')
      .insert({
        donor_id: req.user.uid,
        status: 'listed',
        pickup_lat,
        pickup_lng,
        pickup_address_label: addressLabel,
      })
      .returning([
        'id',
        'donor_id',
        'status',
        'pickup_lat',
        'pickup_lng',
        'pickup_address_label',
        'created_at',
      ]);

    const itemRows = items.map((item) => ({
      listing_id: createdListing.id,
      category: item.category,
      condition: item.condition,
      photo_url: item.photo_url,
    }));

    const createdItems = await trx('listing_items')
      .insert(itemRows)
      .returning(['id', 'category', 'condition', 'photo_url']);

    return { ...createdListing, items: createdItems };
  });

  return res.status(201).json(listing);
});

// GET /listings/mine — LLD §3.3: donor-only, the donor's own listings with
// current status (spec.md §2 Donor capability). Scoped strictly to req.user.uid
// so one donor never sees another donor's listings.
//
// delivered listings get a delivery_confirmation_note (task 5.7, spec.md §4
// step 5: "donor receives a confirmation note closing the loop") built from
// the distribution record — referencing the receiver's general area gives a
// more meaningful close than a generic canned message, while staying within
// the minimal non-identifying info already captured (spec.md §7).
router.get('/mine', requireAuth, requireRole('donor'), async (req, res) => {
  const listings = await db('listings')
    .where({ donor_id: req.user.uid })
    .orderBy('created_at', 'desc');

  const listingIds = listings.map((listing) => listing.id);
  const items = listingIds.length
    ? await db('listing_items').whereIn('listing_id', listingIds)
    : [];
  const distributions = listingIds.length
    ? await db('distributions').whereIn('listing_id', listingIds)
    : [];

  const itemsByListingId = items.reduce((acc, item) => {
    (acc[item.listing_id] = acc[item.listing_id] || []).push(item);
    return acc;
  }, {});
  const distributionByListingId = distributions.reduce((acc, distribution) => {
    acc[distribution.listing_id] = distribution;
    return acc;
  }, {});

  const result = listings.map((listing) => {
    const withItems = { ...listing, items: itemsByListingId[listing.id] || [] };

    if (listing.status === 'delivered') {
      const distribution = distributionByListingId[listing.id];
      withItems.delivery_confirmation_note = distribution
        ? `Delivered to a receiver in ${distribution.receiver_general_area}. Thank you for your donation!`
        : 'Your donation has been delivered. Thank you for your donation!';
    }

    return withItems;
  });

  return res.status(200).json(result);
});

// GET /listings/open — LLD §3.3: verified-NGO-only (spec.md §7: only
// government-verified NGOs may browse/claim).
//
// lat/lng are optional here (not strictly required per task 4.4) so this
// stays backward compatible with browsing without a location — when given,
// results are filtered to `radius` km (default 15, LLD §7.3/spec.md §10 open
// item on exact tuning) and sorted nearest-first. category (task 4.6), when
// given, only includes listings that have at least one item in that category.
//
// pickup_lat/pickup_lng are always stripped from the response (task 4.7,
// spec.md §7): a browsing NGO gets approximate distance (when computed), never
// the donor's exact pickup coordinates — those are only shown once claimed.
router.get('/open', requireAuth, requireVerifiedNgo, async (req, res) => {
  const { lat, lng, radius, category } = req.query;

  let query = db('listings').where({ status: 'listed' });
  if (category) {
    query = query.whereIn('id', db('listing_items').select('listing_id').where({ category }));
  }

  const listings = await query.orderBy('created_at', 'desc');

  let result = listings;

  if (lat !== undefined && lng !== undefined) {
    const originLat = Number(lat);
    const originLng = Number(lng);
    const radiusKm = radius !== undefined ? Number(radius) : DEFAULT_OPEN_LISTINGS_RADIUS_KM;

    result = listings
      .map((listing) => ({
        ...listing,
        distance_km: haversineDistanceKm(
          originLat,
          originLng,
          Number(listing.pickup_lat),
          Number(listing.pickup_lng),
        ),
      }))
      .filter((listing) => listing.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);
  }

  const masked = result.map(({ pickup_lat, pickup_lng, ...rest }) => rest);

  return res.status(200).json(masked);
});

// POST /listings/:id/claim — LLD §3.4: verified-NGO-only. Creates a claims
// row (expires_at defaults to claimed_at + 48h per task 1.6's schema default),
// transitions the listing listed -> claimed via the central transition
// function (task 4.1), and notifies the donor (task 4.10, type='claimed').
//
// Race handling (task 4.9): the pre-check above covers the common sequential
// case, but two requests can both read status='listed' before either commits.
// transitionListingStatus's WHERE-guarded UPDATE (task 4.1) still guarantees
// only one of them actually changes the row — the loser's UPDATE matches 0
// rows and throws InvalidStatusTransitionError. The claims table's partial
// unique index (task 1.7) is a second line of defense if the race were ever
// won at the insert instead. Either way, this must resolve to a clean 409,
// never a raw DB error leaking through as a 500.
router.post('/:id/claim', requireAuth, requireVerifiedNgo, async (req, res) => {
  const { id } = req.params;

  const listing = await db('listings').where({ id }).first();
  if (!listing) {
    return res.status(404).json({ message: 'Listing not found' });
  }
  if (listing.status !== 'listed') {
    return res
      .status(409)
      .json({ message: `Cannot claim a listing with status '${listing.status}'` });
  }

  try {
    const claim = await db.transaction(async (trx) => {
      await transitionListingStatus(trx, id, listing.status, 'claimed');

      const [createdClaim] = await trx('claims')
        .insert({ listing_id: id, ngo_id: req.user.uid })
        .returning(['id', 'listing_id', 'ngo_id', 'claimed_at', 'expires_at', 'status']);

      await trx('notifications').insert({
        user_id: listing.donor_id,
        listing_id: id,
        type: 'claimed',
        message: 'Your listing has been claimed by an NGO.',
      });

      return createdClaim;
    });

    return res.status(201).json(claim);
  } catch (err) {
    if (err instanceof InvalidStatusTransitionError || err.code === '23505') {
      return res.status(409).json({ message: 'This listing was just claimed by someone else' });
    }
    throw err;
  }
});

// POST /listings/:id/cancel — LLD §3.3: "donor (owner)". Ownership is checked
// here since LLD's role column says "owner" explicitly, not just "donor" — a
// donor cancelling someone else's listing isn't a case any of tasks 3.7-3.10
// call out separately, but it's inherent to what this endpoint's role means.
//
// The actual status/cancellation_reason update (task 3.10) and the NGO
// notification (task 3.9) are written here as one transaction rather than two
// separate changes: per HLD §6.4's sequence diagram they're the same atomic
// operation ("Listing.status=Cancelled..." then, if it was claimed, "Insert
// Notification"), so splitting them across tasks would mean leaving a
// half-correct handler (e.g. notifying about a cancellation that didn't
// actually happen) in between. Each task still gets its own dedicated test.
router.post('/:id/cancel', requireAuth, requireRole('donor'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  const listing = await db('listings').where({ id }).first();
  if (!listing) {
    return res.status(404).json({ message: 'Listing not found' });
  }
  if (listing.donor_id !== req.user.uid) {
    return res.status(403).json({ message: 'Not the owner of this listing' });
  }

  if (!reason) {
    return res.status(400).json({ message: 'reason is required' });
  }

  // LLD §2/§6.2: cancel only valid pre-pickup. Once picked_up/distributed/
  // delivered, LLD §2's state machine has no cancelled transition from there.
  if (!['listed', 'claimed'].includes(listing.status)) {
    return res
      .status(409)
      .json({ message: `Cannot cancel a listing with status '${listing.status}'` });
  }

  const wasClaimed = listing.status === 'claimed';

  const cancelled = await db.transaction(async (trx) => {
    const updatedListing = await transitionListingStatus(trx, id, listing.status, 'cancelled', {
      cancellation_reason: reason,
      cancelled_at: trx.fn.now(),
    });

    if (wasClaimed) {
      const activeClaim = await trx('claims').where({ listing_id: id, status: 'active' }).first();
      if (activeClaim) {
        await trx('claims').where({ id: activeClaim.id }).update({ status: 'cancelled' });
        await trx('notifications').insert({
          user_id: activeClaim.ngo_id,
          listing_id: id,
          type: 'cancelled',
          message: `The donor cancelled a listing you claimed. Reason: ${reason}`,
        });
      }
    }

    return updatedListing;
  });

  return res.status(200).json(cancelled);
});

module.exports = router;
