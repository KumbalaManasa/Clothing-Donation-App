import { useState } from 'react'
import { apiFetch } from '../api/client.js'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// spec.md §6.4 step 4 / LLD §3.4: receiver first name + general area required
// (minimal non-identifying info, spec.md §7), photo explicitly optional.
// Server also enforces the required fields (POST /claims/:id/distribute), so
// this is defense in depth, same as CancelListingModal's reason field.
function DistributeForm({ claimId, onDistributed }) {
  const [open, setOpen] = useState(false)
  const [receiverFirstName, setReceiverFirstName] = useState('')
  const [receiverGeneralArea, setReceiverGeneralArea] = useState('')
  const [photo, setPhoto] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function openModal() {
    setOpen(true)
    setReceiverFirstName('')
    setReceiverGeneralArea('')
    setPhoto(null)
    setValidationError(null)
    setSubmitError(null)
  }

  function closeModal() {
    setOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!receiverFirstName.trim() || !receiverGeneralArea.trim()) {
      setValidationError('Receiver first name and general area are both required')
      return
    }
    setValidationError(null)
    setSubmitError(null)
    setSubmitting(true)

    try {
      const body = {
        receiver_first_name: receiverFirstName.trim(),
        receiver_general_area: receiverGeneralArea.trim(),
      }
      if (photo) {
        body.photo = await readFileAsDataUrl(photo)
      }

      await apiFetch(`/claims/${claimId}/distribute`, { method: 'POST', body })
      setOpen(false)
      onDistributed?.()
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" data-testid="distribute-button" onClick={openModal}>
        Distribute
      </button>
      {open && (
        <div data-testid="distribute-modal" role="dialog">
          <form onSubmit={handleSubmit}>
            <label>
              Receiver first name
              <input
                aria-label="Receiver first name"
                data-testid="receiver-first-name-input"
                value={receiverFirstName}
                onChange={(e) => setReceiverFirstName(e.target.value)}
              />
            </label>
            <label>
              Receiver general area
              <input
                aria-label="Receiver general area"
                data-testid="receiver-general-area-input"
                value={receiverGeneralArea}
                onChange={(e) => setReceiverGeneralArea(e.target.value)}
              />
            </label>
            <label>
              Photo (optional)
              <input
                type="file"
                accept="image/*"
                aria-label="Distribution photo"
                data-testid="distribute-photo-input"
                onChange={(e) => setPhoto(e.target.files[0] || null)}
              />
            </label>
            {validationError && <p data-testid="distribute-validation-error">{validationError}</p>}
            {submitError && <p data-testid="distribute-submit-error">{submitError}</p>}
            <button type="submit" data-testid="distribute-confirm" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Confirm distribution'}
            </button>
            <button type="button" data-testid="distribute-dismiss" onClick={closeModal}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export default DistributeForm
