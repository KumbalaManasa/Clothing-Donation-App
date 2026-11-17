import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client.js'
import DistributeForm from '../components/DistributeForm.jsx'
import DonationProgress from '../components/DonationProgress.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ClaimOutcomeAction from '../components/ClaimOutcomeAction.jsx'

// Claim redirect target (task 10.5's own verify wording: claiming should move
// the listing "into 'My Claims'"), plus pickup/distribute actions per claim
// (task 10.6/10.7): which action applies is driven by listing_status (LLD §2
// state machine), not the claim's own status/picked_up_at — a claim stays
// "active" straight through pickup and distribute, so listing_status is the
// only reliable signal for which step comes next.
function MyClaimsPage() {
  const [claims, setClaims] = useState(null)
  const [error, setError] = useState(null)
  const [pickupError, setPickupError] = useState(null)

  const refetch = useCallback(() => {
    return apiFetch('/ngo/claims/mine')
      .then(setClaims)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function handlePickup(claimId) {
    setPickupError(null)
    try {
      await apiFetch(`/claims/${claimId}/pickup`, { method: 'POST' })
      await refetch()
    } catch (err) {
      setPickupError(err.message)
    }
  }

  if (error) return <p data-testid="my-claims-error">{error}</p>
  if (!claims) return <p>Loading...</p>

  return (
    <div data-testid="my-claims" className="records-list">
      <h2>My Claims</h2>
      {pickupError && <p data-testid="pickup-error">{pickupError}</p>}
      {claims.length === 0 && <p>No claims yet.</p>}
      {claims.map((claim) => (
        <div key={claim.id} data-testid="claim-row" className="donation-record-card claim-record-card">
          <span data-testid="claim-status">{claim.status}</span>
          {' — '}
          <span data-testid="claim-listing-status" data-status={claim.listing_status}>
            <StatusBadge status={claim.listing_status} />
          </span>
          {' — '}
          {claim.pickup_address_label}
          <DonationProgress status={claim.listing_status} />
          {claim.listing_status === 'claimed' && (
            <>
              <button type="button" data-testid="pickup-button" onClick={() => handlePickup(claim.id)}>
                Mark picked up
              </button>
              {claim.status === 'active' && <ClaimOutcomeAction claimId={claim.id} outcome="decline" onSaved={refetch} />}
            </>
          )}
          {claim.listing_status === 'picked_up' && (
            <><DistributeForm claimId={claim.id} onDistributed={refetch} />
              {claim.status === 'active' && <ClaimOutcomeAction claimId={claim.id} outcome="fail" onSaved={refetch} />}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

export default MyClaimsPage
