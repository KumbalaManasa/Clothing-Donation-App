// Central status-transition function — LLD §2's full state machine. Every UPDATE
// that changes listings.status must go through transitionListingStatus() rather
// than writing its own raw UPDATE; that's what future tasks (claim, pickup,
// distribute/deliver, expiry) will call instead of hand-rolling their own status
// writes. This only enforces structural from->to legality (LLD §2's table);
// actor/ownership/guard-condition checks (who's allowed to trigger a given
// transition) stay in the route handlers, since they need request-specific
// context (req.user, claim ownership) this function doesn't have.
const ALLOWED_TRANSITIONS = {
  listed: ['claimed', 'cancelled'],
  claimed: ['picked_up', 'cancelled', 'listed'],
  picked_up: ['distributed', 'failed'],
  distributed: ['delivered'],
  delivered: [],
  cancelled: [],
  failed: [],
};

class InvalidStatusTransitionError extends Error {
  constructor(fromStatus, toStatus) {
    super(`Cannot transition listing status from '${fromStatus}' to '${toStatus}'`);
    this.name = 'InvalidStatusTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

// trx: an active Knex transaction. extraFields: additional columns to set in
// the same UPDATE (e.g. cancellation_reason). The WHERE clause includes
// fromStatus as an optimistic-concurrency guard — if the row's status already
// changed since it was read (a race with another request), this throws rather
// than silently overwriting a status another request already moved past.
async function transitionListingStatus(trx, listingId, fromStatus, toStatus, extraFields = {}) {
  const allowedTargets = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowedTargets.includes(toStatus)) {
    throw new InvalidStatusTransitionError(fromStatus, toStatus);
  }

  const [updated] = await trx('listings')
    .where({ id: listingId, status: fromStatus })
    .update({ status: toStatus, updated_at: trx.fn.now(), ...extraFields })
    .returning('*');

  if (!updated) {
    throw new InvalidStatusTransitionError(fromStatus, toStatus);
  }

  return updated;
}

module.exports = { transitionListingStatus, InvalidStatusTransitionError, ALLOWED_TRANSITIONS };
