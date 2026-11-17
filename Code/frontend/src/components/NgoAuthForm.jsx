import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// NGO login/signup (task 10.1). Signup fields per spec.md §6.3 step 1: org
// name, registration/approval number, contact details. Calls the already-built
// POST /auth/signup/ngo (LLD §3.1) via useAuth()'s signupNgo, which merges the
// returned verification_status into the logged-in user so the caller (NgoPage)
// can show it immediately.
function NgoAuthForm() {
  const { login, signupNgo } = useAuth()
  const [mode, setMode] = useState('login') // login | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signupNgo({ name, email, phone, password, orgName, registrationNumber })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form data-testid="ngo-auth-form" onSubmit={handleSubmit} autoComplete="off">
      <h2>{mode === 'login' ? 'Log in' : 'Sign up'} as an NGO</h2>
      {mode === 'signup' && (
        <>
          <input aria-label="Name" placeholder="Contact name" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input
            aria-label="Organization name"
            placeholder="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <input
            aria-label="Registration number"
            placeholder="Registration number"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
          />
        </>
      )}
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
        {mode === 'login' ? 'Log in' : 'Sign up'}
      </button>
      <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
      </button>
      {mode === 'login' && <Link to="/forgot-password">Forgot password?</Link>}
    </form>
  )
}

export default NgoAuthForm
