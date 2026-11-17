import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const DEFAULT_RADIUS_KM = 15

// Browse/filter open listings (task 10.3, spec.md §6.4 step 1). GET
// /listings/open (LLD §3.3) is verified-NGO-only server-side and stays
// backward compatible without a location — lat/lng only matters once
// captured, at which point radius filtering and nearest-first sort kick in.
function BrowseListings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle') // idle | locating | located | error
  const [locationError, setLocationError] = useState(null)
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM)
  const [category, setCategory] = useState('')
  const [listings, setListings] = useState(null)
  const [error, setError] = useState(null)

  // Same reasoning as CreateListingForm: navigator.geolocation only works on
  // secure contexts (https:// or http://localhost), not a plain http:// LAN
  // address. Unlike the donor side, location here is optional — GET
  // /listings/open already works fine without it — so this just hides the
  // button instead of also needing a manual-entry fallback.
  const geolocationAvailable = typeof window !== 'undefined' && window.isSecureContext && !!navigator.geolocation

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      setLocationError('Geolocation is not supported by this browser')
      return
    }

    setLocationStatus('locating')
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude)
        setLng(position.coords.longitude)
        setLocationStatus('located')
      },
      (err) => {
        setLocationStatus('error')
        setLocationError(err.message)
      },
    )
  }

  // POST /listings/:id/claim (LLD §3.3/§3.4, spec.md §6.4 step 2). On success,
  // navigate to "My Claims" (task 10.6's page — built minimally as a
  // prerequisite here, same pattern as task 9.4/9.5) rather than refetching
  // in place, matching this task's own verify wording: claiming should move
  // the listing "into 'My Claims'".
  async function handleClaim(id) {
    try {
      await apiFetch(`/listings/${id}/claim`, { method: 'POST' })
      navigate('/ngo/claims')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams()
    if (lat !== null && lng !== null) {
      params.set('lat', lat)
      params.set('lng', lng)
      params.set('radius', radius)
    }
    if (category.trim()) {
      params.set('category', category.trim())
    }
    const query = params.toString()

    apiFetch(`/listings/open${query ? `?${query}` : ''}`)
      .then(setListings)
      .catch((err) => setError(err.message))
  }, [lat, lng, radius, category])

  return (
    <div data-testid="browse-listings" className="listing-browser">
      <h2>Browse Listings</h2>
      {geolocationAvailable ? (
        <button type="button" onClick={captureLocation}>
          Use my current location
        </button>
      ) : (
        <div data-testid="geolocation-unavailable">
          <p>
            GPS location isn't available on this connection — you can still browse and claim listings without it, or
            enter coordinates manually below to filter/sort by distance anyway.
          </p>
          <label>
            Latitude
            <input
              type="number"
              step="any"
              aria-label="Latitude"
              value={lat ?? ''}
              onChange={(e) => setLat(e.target.value === '' ? null : Number(e.target.value))}
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              aria-label="Longitude"
              value={lng ?? ''}
              onChange={(e) => setLng(e.target.value === '' ? null : Number(e.target.value))}
            />
          </label>
        </div>
      )}
      {locationStatus === 'locating' && <p>Locating...</p>}
      {locationStatus === 'error' && <p>Location error: {locationError}</p>}
      <label>
        Radius (km)
        <input
          type="number"
          aria-label="Radius"
          data-testid="radius-input"
          value={radius}
          min="1"
          disabled={lat === null}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </label>
      <label>
        Category
        <input
          type="text"
          aria-label="Category filter"
          data-testid="category-filter-input"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </label>

      {error && <p data-testid="browse-listings-error">{error}</p>}
      {listings && listings.length === 0 && <p>No open listings match.</p>}
      {listings &&
        listings.map((listing) => (
          <div key={listing.id} data-testid="open-listing-row" className="donation-record-card open-listing-card">
            {listing.pickup_address_label}
            {listing.distance_km !== undefined && ` — ${listing.distance_km.toFixed(1)} km`}
            {/* task 10.4: gated here too, not just by the page only rendering
                BrowseListings for verified accounts — the claim control itself
                must never appear for a not_verified account through any path. */}
            {user.verification_status === 'verified' && (
              <button type="button" data-testid="claim-button" onClick={() => handleClaim(listing.id)}>
                Claim
              </button>
            )}
          </div>
        ))}
    </div>
  )
}

export default BrowseListings
