const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// GET /admin/listings — LLD §3.6: admin-only, list/filter listings for
// moderation (spec.md §6.6 step 1). Optional status filter, same convention
// as GET /listings/open.
router.get('/listings', requireAuth, requireRole('admin'), async (req, res) => {
  const { status } = req.query;

  let query = db('listings');
  if (status) {
    query = query.where({ status });
  }

  const listings = await query.orderBy('created_at', 'desc');
  return res.status(200).json(listings);
});

// DELETE /admin/listings/:id — LLD §3.6: admin-only, removes a listing that
// violates content guidelines (spec.md §6.6 step 1). Dependent rows
// (notifications, distributions, claims) aren't ON DELETE CASCADE from
// listings — only listing_items is (task 1.5) — so they're removed
// explicitly first, in one transaction, so this works regardless of what
// lifecycle stage the listing was in when moderated.
router.delete('/listings/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  const listing = await db('listings').where({ id }).first();
  if (!listing) {
    return res.status(404).json({ message: 'Listing not found' });
  }

  await db.transaction(async (trx) => {
    await trx('notifications').where({ listing_id: id }).delete();
    await trx('distributions').where({ listing_id: id }).delete();
    await trx('claims').where({ listing_id: id }).delete();
    await trx('listings').where({ id }).delete();
  });

  return res.status(204).send();
});

// GET /admin/claims/stale — LLD §3.6: admin-only, read-only visibility into
// expired/stale claims (spec.md §6.6 step 2) — the expiry job (Phase 6)
// handles the actual sweep automatically; this is view-only.
router.get('/claims/stale', requireAuth, requireRole('admin'), async (req, res) => {
  const claims = await db('claims').where({ status: 'expired' }).orderBy('expires_at', 'desc');
  return res.status(200).json(claims);
});

// GET /admin/ngo-verifications — LLD §3.6: admin-only, read-only audit log
// of verification attempts (spec.md §6.6 step 3), for dispute handling. No
// PATCH/approve endpoint exists anywhere (task 8.5) — deliberate, per
// spec.md §3's "no manual admin review fallback".
router.get('/ngo-verifications', requireAuth, requireRole('admin'), async (req, res) => {
  const verifications = await db('users')
    .where({ role: 'ngo' })
    .select(
      'id',
      'org_name',
      'registration_number',
      'verification_status',
      'verification_checked_at',
      'verification_source_ref',
    )
    .orderBy('verification_checked_at', 'desc');

  return res.status(200).json(verifications);
});

module.exports = router;
