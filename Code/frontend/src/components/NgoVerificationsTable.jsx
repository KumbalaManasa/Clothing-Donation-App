import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api/client.js'

// NGO verification audit log (task 11.3, spec.md §6.6 step 3). GET
// /admin/ngo-verifications (task 8.4) has no server-side search param, so
// filtering by org_name/registration_number happens client-side over the
// full list it already returns — there's no mutation path here at all (task
// 8.5/11.4: no admin control anywhere can flip verification_status).
function NgoVerificationsTable() {
  const [verifications, setVerifications] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiFetch('/admin/ngo-verifications')
      .then(setVerifications)
      .catch((err) => setError(err.message))
  }, [])

  const filtered = useMemo(() => {
    if (!verifications) return null
    const query = search.trim().toLowerCase()
    if (!query) return verifications
    return verifications.filter(
      (v) =>
        (v.org_name || '').toLowerCase().includes(query) ||
        (v.registration_number || '').toLowerCase().includes(query),
    )
  }, [verifications, search])

  if (error) return <p data-testid="admin-ngo-verifications-error">{error}</p>
  if (!filtered) return <p>Loading...</p>

  return (
    <div data-testid="admin-ngo-verifications-table">
      <h2>NGO Verification Audit Log</h2>
      <label>
        Search by org name or registration number
        <input
          type="text"
          aria-label="Search NGO verifications"
          data-testid="ngo-verifications-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {filtered.length === 0 && <p>No matching NGO verification records.</p>}
      {filtered.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Org name</th>
              <th>Registration number</th>
              <th>Status</th>
              <th>Checked at</th>
              <th>Source ref</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} data-testid="admin-ngo-verification-row">
                <td>{v.org_name}</td>
                <td>{v.registration_number}</td>
                <td>{v.verification_status}</td>
                <td>{v.verification_checked_at ? new Date(v.verification_checked_at).toLocaleString() : ''}</td>
                <td>{v.verification_source_ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default NgoVerificationsTable
