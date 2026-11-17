// Scheduled job runner — LLD §4: claim expiry job, "5-10 minute cron interval
// is sufficient given the 48-hour expiry window." startClaimExpiryJob (task
// 6.1) is just the scheduling mechanism; runClaimExpirySweep (task 6.3) is
// the actual work, callable directly as "one job run" for tests without
// waiting on a real timer.
const db = require('../db');
const { findStaleClaims } = require('../services/staleClaims');
const { transitionListingStatus } = require('../services/listingStatusTransitions');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function getIntervalMs() {
  const envValue = process.env.CLAIM_EXPIRY_JOB_INTERVAL_MS;
  return envValue ? Number(envValue) : DEFAULT_INTERVAL_MS;
}

// Returns the interval handle so the caller can clearInterval() it (e.g. on
// graceful shutdown, or between tests).
function startClaimExpiryJob(runSweep) {
  const intervalMs = getIntervalMs();
  return setInterval(runSweep, intervalMs);
}

// Per-claim expiry transaction (task 6.3): claim -> expired, listing ->
// listed (only if still claimed — LLD §4 pseudocode's "WHERE ... status =
// 'claimed'"), two notifications (NGO + donor, type='expired'). The
// `WHERE status='active'` guard on the claims UPDATE makes this idempotent
// (task 6.5): if another run already expired this claim, the update affects
// 0 rows and everything else is skipped rather than double-processed.
async function expireOneClaim(claimId) {
  return db.transaction(async (trx) => {
    const [expiredClaim] = await trx('claims')
      .where({ id: claimId, status: 'active' })
      .update({ status: 'expired' })
      .returning(['id', 'listing_id', 'ngo_id']);

    if (!expiredClaim) {
      return null;
    }

    const listing = await trx('listings').where({ id: expiredClaim.listing_id }).first();
    if (listing.status === 'claimed') {
      await transitionListingStatus(trx, expiredClaim.listing_id, 'claimed', 'listed');
    }

    await trx('notifications').insert([
      {
        user_id: expiredClaim.ngo_id,
        listing_id: expiredClaim.listing_id,
        type: 'expired',
        message: 'Your claim expired before you marked the listing picked up.',
      },
      {
        user_id: listing.donor_id,
        listing_id: expiredClaim.listing_id,
        type: 'expired',
        message: 'The claim on your listing expired; it is available again.',
      },
    ]);

    return expiredClaim;
  });
}

// One sweep = one job run: find every stale claim (task 6.2), then expire
// each in its own transaction (LLD §4 pseudocode: "for each stale claim, in
// one transaction per claim").
async function runClaimExpirySweep() {
  const staleClaims = await db.transaction((trx) => findStaleClaims(trx));

  const results = [];
  for (const claim of staleClaims) {
    results.push(await expireOneClaim(claim.id));
  }
  return results;
}

module.exports = {
  startClaimExpiryJob,
  getIntervalMs,
  DEFAULT_INTERVAL_MS,
  runClaimExpirySweep,
  expireOneClaim,
};
