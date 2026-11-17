import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// "Not verified" account state screen (task 10.2, spec.md §6.3 step 4: "the
// NGO must correct and resubmit their registration details... to trigger a
// re-check" — there is no manual admin review fallback). Pre-fills the
// current registration_number so the NGO can fix a typo and resubmit in place.
function NgoReverifyForm({ registrationNumber }) {
  const { reverifyNgo } = useAuth()
  const [value, setValue] = useState(registrationNumber || '')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await reverifyNgo(value)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div data-testid="ngo-not-verified-screen">
      <p>
        Your NGO account is not verified. There is no manual review — please double-check your
        registration number and resubmit to trigger a fresh check against the government
        verification source.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Registration number
          <input
            aria-label="Registration number"
            data-testid="reverify-registration-number-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error && <p data-testid="reverify-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Checking...' : 'Resubmit for verification'}
        </button>
      </form>
    </div>
  )
}

export default NgoReverifyForm
