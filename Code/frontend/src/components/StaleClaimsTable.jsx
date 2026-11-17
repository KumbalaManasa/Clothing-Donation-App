import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client.js'

// Stale claims read-only view (task 11.2, spec.md §6.6 step 2). GET
// /admin/claims/stale (task 8.3) already returns exactly the expired claims —
// the expiry job (Phase 6) is what actually sweeps them; this is visibility
// only, so there's no action column here, unlike ListingsModerationTable.
function StaleClaimsTable() {
  const [claims, setClaims] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch('/admin/claims/stale')
      .then(setClaims)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <p data-testid="admin-stale-claims-error">{error}</p>
  if (!claims) return <p>Loading...</p>

  return (
    <div data-testid="admin-stale-claims-table">
      <h2>Stale Claims</h2>
      {claims.length === 0 && <p>No stale claims.</p>}
      {claims.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Listing</th>
              <th>NGO</th>
              <th>Claimed</th>
              <th>Expired</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} data-testid="admin-stale-claim-row">
                <td>{claim.listing_id}</td>
                <td>{claim.ngo_id}</td>
                <td>{new Date(claim.claimed_at).toLocaleString()}</td>
                <td>{new Date(claim.expires_at).toLocaleString()}</td>
                <td>{claim.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default StaleClaimsTable
