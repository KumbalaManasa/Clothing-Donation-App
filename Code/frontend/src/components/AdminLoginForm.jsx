import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Admin login only — no signup form, deliberately: admin accounts aren't
// self-service (spec.md §3/§6.6), so the only way to get one is the dev seed
// script (Spec/tasks.md task 1.10) or, in production, an operator creating
// the row directly. useAuth()'s login() is already role-agnostic (task 9's
// DonorAuthForm/task 10's NgoAuthForm both call the same function), so this
// is just that same call without a signup mode toggle.
function AdminLoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form data-testid="admin-auth-form" onSubmit={handleSubmit} autoComplete="off">
      <h2>Log in as admin</h2>
      <input
        aria-label="Email"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
      />
      <input
        aria-label="Password"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      {error && <p data-testid="auth-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        Log in
      </button>
      <Link to="/forgot-password">Forgot password?</Link>
    </form>
  )
}

export default AdminLoginForm
