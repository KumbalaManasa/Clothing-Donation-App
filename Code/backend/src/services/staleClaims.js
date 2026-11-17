// Stale-claim query — LLD §4/§6.5: active claims that have expired without
// being picked up. FOR UPDATE SKIP LOCKED means multiple job workers could
// run this concurrently without double-processing the same claim (LLD §4:
// "prevents double-processing if the job is ever scaled to multiple
// workers"). Must run inside a transaction (FOR UPDATE requires one). The
// actual per-claim expiry transaction (task 6.3) is separate.
async function findStaleClaims(trx) {
  return trx('claims')
    .where('status', 'active')
    .whereNull('picked_up_at')
    .where('expires_at', '<', trx.fn.now())
    .forUpdate()
    .skipLocked();
}

module.exports = { findStaleClaims };
