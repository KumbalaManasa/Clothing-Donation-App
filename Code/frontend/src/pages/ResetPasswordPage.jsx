import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api/client.js'

// Landing page for the 'link' forgot-password method (Code/backend/src/routes/auth.js
// POST /auth/reset-password/link) — the token in the URL identifies the
// account, so this page never asks for an email, just a new password.
function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/reset-password/link', { method: 'POST', body: { token, new_password: newPassword } })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div>
        <h1>Reset Password</h1>
        <p data-testid="reset-link-missing-token">This link is missing its reset token.</p>
        <Link to="/forgot-password">Request a new link</Link>
      </div>
    )
  }

  if (done) {
    return (
      <div>
        <h1>Reset Password</h1>
        <p data-testid="reset-success">Password has been reset. You can now log in.</p>
        <Link to="/">Back to home</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>Reset Password</h1>
      <form data-testid="reset-link-form" onSubmit={handleSubmit}>
        <input
          type="password"
          aria-label="New password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && <p data-testid="reset-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </div>
  )
}

export default ResetPasswordPage
