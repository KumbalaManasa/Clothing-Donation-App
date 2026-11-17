import { useState } from 'react'
import { apiFetch } from '../api/client.js'

function ClaimOutcomeAction({ claimId, outcome, onSaved }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const declined = outcome === 'decline'

  async function submit(event) {
    event.preventDefault()
    if (!declined && !reason.trim()) {
      setError('Add a short reason so the donor understands what happened.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/claims/${claimId}/${declined ? 'decline' : 'fail'}`, {
        method: 'POST', body: { reason: reason.trim() },
      })
      setOpen(false)
      setReason('')
      onSaved?.()
    } catch (err) {
      setError(err.message || 'Unable to update claim')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <button type="button" className="claim-outcome-button" onClick={() => { setOpen(true); setError('') }}>
      {declined ? 'Release claim' : 'Mark delivery failed'}
    </button>
    {open && <div className="claim-outcome-overlay" role="presentation">
      <form className="claim-outcome-dialog" role="dialog" aria-modal="true" aria-labelledby={`outcome-title-${claimId}`} onSubmit={submit}>
        <h3 id={`outcome-title-${claimId}`}>{declined ? 'Release this claim?' : 'Record delivery failure'}</h3>
        <p>{declined ? 'The donation will return to the open listings for another NGO.' : 'This marks the picked-up donation as not delivered and informs the donor.'}</p>
        <label>{declined ? 'Reason (optional)' : 'Reason'}
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows="3" maxLength="500" />
        </label>
        {error && <p className="claim-outcome-error" role="alert">{error}</p>}
        <div className="claim-outcome-actions">
          <button type="button" onClick={() => setOpen(false)} disabled={saving}>Keep claim</button>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : declined ? 'Release claim' : 'Confirm failure'}</button>
        </div>
      </form>
    </div>}
  </>
}

export default ClaimOutcomeAction
