import { useState } from 'react'
import { apiFetch } from '../api/client.js'

// spec.md §6.2: donor cancels with a required reason; server also rejects an
// empty reason (LLD listings.js POST /:id/cancel), so this is defense in
// depth, not the only guard.
function CancelListingModal({ listingId, onCancelled }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function openModal() {
    setOpen(true)
    setReason('')
    setValidationError(null)
    setSubmitError(null)
  }

  function closeModal() {
    setOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!reason.trim()) {
      setValidationError('A reason is required')
      return
    }
    setValidationError(null)
    setSubmitError(null)
    setSubmitting(true)

    try {
      await apiFetch(`/listings/${listingId}/cancel`, { method: 'POST', body: { reason: reason.trim() } })
      setOpen(false)
      onCancelled?.()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" data-testid="cancel-button" onClick={openModal}>
        Cancel listing
      </button>
      {open && (
        <div data-testid="cancel-modal" role="dialog">
          <form onSubmit={handleSubmit}>
            <label>
              Reason for cancelling
              <textarea
                data-testid="cancel-reason-input"
                aria-label="Reason for cancelling"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {validationError && <p data-testid="cancel-validation-error">{validationError}</p>}
            {submitError && <p data-testid="cancel-submit-error">{submitError}</p>}
            <button type="submit" data-testid="cancel-confirm" disabled={submitting}>
              {submitting ? 'Cancelling...' : 'Confirm cancellation'}
            </button>
            <button type="button" data-testid="cancel-dismiss" onClick={closeModal}>
              Keep listing
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export default CancelListingModal
