import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, resolveAssetUrl } from '../api/client.js'
import StatusBadge from '../components/StatusBadge.jsx'
import DonationProgress from '../components/DonationProgress.jsx'
import CancelListingModal from '../components/CancelListingModal.jsx'

// Polling interval for status badge updates (task 9.6). No push mechanism
// exists (HLD explicitly builds no real-time infra), so this is a plain
// interval refetch — same "open engineering choice" as the backend claim
// expiry job (LLD §4), but much shorter since this is user-facing rather
// than a 48h-window cron.
const POLL_INTERVAL_MS = 5000

// Cancel is only a valid transition from these statuses (LLD §2 state
// machine: listed->cancelled, claimed->cancelled; nothing past picked_up
// has a cancelled transition — spec.md §6.2, task 9.8).
const CANCELLABLE_STATUSES = new Set(['listed', 'claimed'])

// Redirect target for task 9.4 ("full form submit creates a listing visible
// immediately in 'My Listings'"), plus the status badge from task 9.5 and
// the live poll from task 9.6.
function MyListingsPage() {
  const [listings, setListings] = useState(null)
  const [error, setError] = useState(null)

  // The 5s poll and CancelListingModal's onCancelled={refetch} both trigger
  // this independently. Without a guard, a poll already in flight when a
  // cancel completes can resolve *after* the cancel's own refetch and
  // overwrite the just-cancelled status with the stale pre-cancel snapshot
  // it fetched earlier -- same race as NotificationCenter's poll vs.
  // markRead. Only the response to whichever request was issued *last* is
  // allowed to apply.
  const latestRequestId = useRef(0)

  const refetch = useCallback(() => {
    const requestId = ++latestRequestId.current
    return apiFetch('/listings/mine')
      .then((data) => {
        if (requestId === latestRequestId.current) setListings(data)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    refetch()
    const intervalId = setInterval(refetch, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [refetch])

  if (error) return <p data-testid="my-listings-error">{error}</p>
  if (!listings) return <p>Loading...</p>

  return (
    <div data-testid="my-listings" className="records-list">
      <h2>My Listings</h2>
      {listings.length === 0 && <p>No listings yet.</p>}
      {listings.map((listing) => (
        <div key={listing.id} data-testid="listing-row" className="donation-record-card">
          <StatusBadge status={listing.status} />
          {' — '}
          {listing.pickup_address_label}
          {' — '}
          {listing.items.length} item(s)
          <DonationProgress status={listing.status} />
          <div data-testid="listing-items">
            {listing.items.map((item) => (
              <span key={item.id} data-testid="listing-item" className="listing-item-photo-frame">
                {item.photo_url && (
                  <img
                    src={resolveAssetUrl(item.photo_url)}
                    alt={item.category || 'Donated item'}
                    data-testid="listing-item-photo"
                    width="116"
                    height="116"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.hidden = true
                      event.currentTarget.nextElementSibling.hidden = false
                    }}
                  />
                )}
                <span className="listing-photo-fallback" hidden>
                  {item.photo_url ? 'Photo unavailable' : 'No photo'}
                </span>
              </span>
            ))}
          </div>
          {CANCELLABLE_STATUSES.has(listing.status) && (
            <CancelListingModal listingId={listing.id} onCancelled={refetch} />
          )}
          {listing.status === 'delivered' && (
            <p data-testid="delivery-confirmation-note">{listing.delivery_confirmation_note}</p>
          )}
        </div>
      ))}
    </div>
  )
}

export default MyListingsPage
