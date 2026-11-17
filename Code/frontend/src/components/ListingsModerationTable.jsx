import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client.js'
import StatusBadge from './StatusBadge.jsx'

// Listings moderation table (task 11.1, spec.md §6.6 step 1). GET
// /admin/listings (task 8.1) already returns every listing regardless of
// status — this just renders it with a delete action wired to DELETE
// /admin/listings/:id (task 8.2), which removes the listing (and its
// dependent claims/distributions/notifications, per that route) from every
// donor/NGO view in one call.
function ListingsModerationTable() {
  const [listings, setListings] = useState(null)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const refetch = useCallback(() => {
    return apiFetch('/admin/listings')
      .then(setListings)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function handleDelete(id) {
    if (!window.confirm('Delete this listing? This cannot be undone.')) {
      return
    }
    setError(null)
    setDeletingId(id)
    try {
      await apiFetch(`/admin/listings/${id}`, { method: 'DELETE' })
      await refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (error) return <p data-testid="admin-listings-error">{error}</p>
  if (!listings) return <p>Loading...</p>

  return (
    <div data-testid="admin-listings-table">
      <h2>Listings Moderation</h2>
      {listings.length === 0 && <p>No listings.</p>}
      {listings.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Pickup address</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id} data-testid="admin-listing-row">
                <td>
                  <StatusBadge status={listing.status} />
                </td>
                <td>{listing.pickup_address_label}</td>
                <td>{new Date(listing.created_at).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    data-testid="admin-delete-listing"
                    disabled={deletingId === listing.id}
                    onClick={() => handleDelete(listing.id)}
                  >
                    {deletingId === listing.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default ListingsModerationTable
