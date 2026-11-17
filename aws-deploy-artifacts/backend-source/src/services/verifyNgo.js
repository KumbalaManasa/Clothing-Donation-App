/**
 * Stub/mock implementation of the government NGO verification integration seam
 * (LLD §3.2). Which real government verification source to integrate with is
 * still an open item (spec.md §10) — this stub stands in for it using sentinel
 * registration_number prefixes so the rest of the signup/reverify flow can be
 * built and tested against it now:
 *
 * - Prefix "APPROVED-" -> simulates a matched, government-approved NGO.
 * - Prefix "TIMEOUT-"  -> simulates the source being unreachable/timing out.
 * - Anything else      -> simulates no matching record found.
 *
 * Always resolves (never rejects) to { status, source_ref } — verifyNgo absorbs
 * source failures internally and fails safe to 'not_verified' (spec.md §6.3 step 5),
 * exactly like a caller (e.g. signup) would experience against the real source.
 *
 * @param {string} registrationNumber
 * @returns {Promise<{ status: 'verified' | 'not_verified', source_ref: string | null }>}
 */
async function verifyNgo(registrationNumber) {
  try {
    const result = await stubGovernmentSourceLookup(registrationNumber);

    if (result.approved) {
      return { status: 'verified', source_ref: result.sourceRef };
    }
    return { status: 'not_verified', source_ref: null };
  } catch (err) {
    return { status: 'not_verified', source_ref: null };
  }
}

async function stubGovernmentSourceLookup(registrationNumber) {
  if (typeof registrationNumber === 'string' && registrationNumber.startsWith('TIMEOUT-')) {
    throw new Error('Simulated government verification source timeout');
  }
  if (typeof registrationNumber === 'string' && registrationNumber.startsWith('APPROVED-')) {
    return { approved: true, sourceRef: `stub-source-ref:${registrationNumber}` };
  }
  return { approved: false, sourceRef: null };
}

module.exports = { verifyNgo };
