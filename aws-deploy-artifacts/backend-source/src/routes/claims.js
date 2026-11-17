const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { transitionListingStatus } = require('../services/listingStatusTransitions');
const { uploadImage, ImageValidationError } = require('../services/imageStorage');

const router = express.Router();

// POST /claims/:id/decline — an NGO can release a claim before pickup. The
// listing returns to the open pool while the claim history remains auditable.
router.post('/:id/decline', requireAuth, requireRole('ngo'), async (req, res) => {
  const { id } = req.params;
  const reason = String(req.body?.reason || '').trim();
  const claim = await db('claims').where({ id }).first();
  if (!claim) return res.status(404).json({ message: 'Claim not found' });
  if (claim.ngo_id !== req.user.uid) return res.status(403).json({ message: 'Not the owner of this claim' });
  if (claim.status !== 'active') return res.status(409).json({ message: 'Only an active claim can be declined' });
  const listing = await db('listings').where({ id: claim.listing_id }).first();
  if (!listing || listing.status !== 'claimed') {
    return res.status(409).json({ message: 'Only a claimed listing can be released' });
  }

  const result = await db.transaction(async (trx) => {
    const [declinedClaim] = await trx('claims').where({ id, status: 'active' }).update({
      status: 'declined', declined_at: trx.fn.now(), decline_reason: reason || null,
    }).returning('*');
    if (!declinedClaim) return null;
    const updatedListing = await transitionListingStatus(trx, listing.id, 'claimed', 'listed');
    await trx('notifications').insert({
      user_id: listing.donor_id, listing_id: listing.id, type: 'declined',
      message: 'An NGO released its claim. Your donation is available to other NGOs.',
    });
    return { claim: declinedClaim, listing: updatedListing };
  });
  if (!result) return res.status(409).json({ message: 'This claim is no longer active' });
  return res.status(200).json(result);
});

// POST /claims/:id/fail — after pickup, an NGO records an explicit delivery
// failure and reason. The terminal listing state prevents an untracked retry.
router.post('/:id/fail', requireAuth, requireRole('ngo'), async (req, res) => {
  const { id } = req.params;
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ message: 'reason is required' });
  const claim = await db('claims').where({ id }).first();
  if (!claim) return res.status(404).json({ message: 'Claim not found' });
  if (claim.ngo_id !== req.user.uid) return res.status(403).json({ message: 'Not the owner of this claim' });
  const listing = await db('listings').where({ id: claim.listing_id }).first();
  if (!listing || listing.status !== 'picked_up' || claim.status !== 'active') {
    return res.status(409).json({ message: 'Only an active picked-up claim can be marked failed' });
  }

  const result = await db.transaction(async (trx) => {
    const [failedClaim] = await trx('claims').where({ id, status: 'active' }).update({
      status: 'failed', failed_at: trx.fn.now(), failure_reason: reason,
    }).returning('*');
    if (!failedClaim) return null;
    const updatedListing = await transitionListingStatus(trx, listing.id, 'picked_up', 'failed');
    await trx('notifications').insert({
      user_id: listing.donor_id, listing_id: listing.id, type: 'failed',
      message: `An NGO could not complete this delivery. Reason: ${reason}`,
    });
    return { claim: failedClaim, listing: updatedListing };
  });
  if (!result) return res.status(409).json({ message: 'This claim is no longer active' });
  return res.status(200).json(result);
});

// POST /claims/:id/pickup — LLD §3.4: "ngo (claim owner)". Ownership check
// (task 4.11); sets picked_up_at, transitions the listing claimed ->
// picked_up (task 4.12), and notifies the donor (task 4.13, type='picked_up')
// — all atomically in one transaction.
router.post('/:id/pickup', requireAuth, requireRole('ngo'), async (req, res) => {
  const { id } = req.params;

  const claim = await db('claims').where({ id }).first();
  if (!claim) {
    return res.status(404).json({ message: 'Claim not found' });
  }
  if (claim.ngo_id !== req.user.uid) {
    return res.status(403).json({ message: 'Not the owner of this claim' });
  }

  const listing = await db('listings').where({ id: claim.listing_id }).first();
  if (!listing) {
    return res.status(404).json({ message: 'Listing not found' });
  }
  if (listing.status !== 'claimed') {
    return res
      .status(409)
      .json({ message: `Cannot mark pickup for a listing with status '${listing.status}'` });
  }

  const result = await db.transaction(async (trx) => {
    const [updatedClaim] = await trx('claims')
      .where({ id })
      .update({ picked_up_at: trx.fn.now() })
      .returning(['id', 'listing_id', 'ngo_id', 'picked_up_at']);

    const updatedListing = await transitionListingStatus(
      trx,
      claim.listing_id,
      listing.status,
      'picked_up',
    );

    await trx('notifications').insert({
      user_id: listing.donor_id,
      listing_id: claim.listing_id,
      type: 'picked_up',
      message: 'Your listing has been picked up by the NGO.',
    });

    return { claim: updatedClaim, listing: updatedListing };
  });

  return res.status(200).json(result);
});

// POST /claims/:id/distribute — LLD §3.4: "ngo (claim owner)". Ownership +
// listing-status guards (task 5.1) and receiver field validation (task 5.2,
// spec.md §7: minimal non-identifying receiver info) run first.
//
// If a photo is provided, it's uploaded via the configurable image storage
// seam (task 5.3, Phase 3; task 13A) before the transaction — photo_url on
// the distributions row is whatever the active driver returns (local path in
// dev, Cloudinary URL in production), or null if no photo was given (LLD
// §1.5, explicitly optional). The distribution insert and the listing's
// picked_up -> distributed -> delivered transition happen together in one
// transaction (task 5.4): "distributed" and "delivered" are the same
// real-world event (spec.md §4 note) — the caller never sees an intermediate
// "distributed" state, only the final "delivered" one (task 5.5). Donor
// notifications for both (task 5.6) are a separate, later task.
router.post('/:id/distribute', requireAuth, requireRole('ngo'), async (req, res) => {
  const { id } = req.params;
  const { receiver_first_name, receiver_general_area, photo } = req.body || {};

  const claim = await db('claims').where({ id }).first();
  if (!claim) {
    return res.status(404).json({ message: 'Claim not found' });
  }
  if (claim.ngo_id !== req.user.uid) {
    return res.status(403).json({ message: 'Not the owner of this claim' });
  }

  const listing = await db('listings').where({ id: claim.listing_id }).first();
  if (!listing) {
    return res.status(404).json({ message: 'Listing not found' });
  }
  if (listing.status !== 'picked_up') {
    return res
      .status(409)
      .json({ message: `Cannot distribute a listing with status '${listing.status}'` });
  }

  if (!receiver_first_name) {
    return res.status(400).json({ message: 'receiver_first_name is required' });
  }
  if (!receiver_general_area) {
    return res.status(400).json({ message: 'receiver_general_area is required' });
  }

  let photoUrl = null;
  if (photo) {
    try {
      photoUrl = await uploadImage(photo);
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  }

  const result = await db.transaction(async (trx) => {
    const [distribution] = await trx('distributions')
      .insert({
        listing_id: claim.listing_id,
        ngo_id: req.user.uid,
        receiver_first_name,
        receiver_general_area,
        photo_url: photoUrl,
      })
      .returning([
        'id',
        'listing_id',
        'ngo_id',
        'receiver_first_name',
        'receiver_general_area',
        'photo_url',
        'distributed_at',
      ]);

    await transitionListingStatus(trx, claim.listing_id, listing.status, 'distributed');
    const deliveredListing = await transitionListingStatus(
      trx,
      claim.listing_id,
      'distributed',
      'delivered',
    );

    // created_at is set explicitly (rather than left to the column default)
    // because both rows land in the same transaction — Postgres's now() is
    // constant for the whole transaction, so without this, "distributed" and
    // "delivered" would get identical timestamps and their relative order
    // would be undefined on read. The 1ms offset preserves their real causal
    // order (distributed happens, delivered follows immediately) without
    // implying they're meaningfully separated in time.
    await trx('notifications').insert([
      {
        user_id: listing.donor_id,
        listing_id: claim.listing_id,
        type: 'distributed',
        message: 'Your listing has been handed to a receiver.',
        created_at: trx.fn.now(),
      },
      {
        user_id: listing.donor_id,
        listing_id: claim.listing_id,
        type: 'delivered',
        message: 'Your donation has been delivered. Thank you for your generosity!',
        created_at: trx.raw("now() + interval '1 millisecond'"),
      },
    ]);

    await trx('claims').where({ id: claim.id, status: 'active' }).update({ status: 'fulfilled' });

    return { distribution, listing: deliveredListing };
  });

  return res.status(201).json(result);
});

module.exports = router;
