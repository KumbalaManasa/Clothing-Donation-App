import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Minimal donor login/signup — a prerequisite for task 9.4 (submitting a
// listing needs a real authenticated session), since no task in Spec/tasks.md
// builds one. Calls the already-built POST /auth/signup/donor and
// POST /auth/login (LLD §3.1).
function DonorAuthForm() {
  const { login, signupDonor } = useAuth()
  const [mode, setMode] = useState('login') // login | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
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
        await signupDonor({ name, email, phone, password })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form data-testid="donor-auth-form" onSubmit={handleSubmit} autoComplete="off">
      <h2>{mode === 'login' ? 'Log in' : 'Sign up'} as a donor</h2>
      {mode === 'signup' && (
        <>
          <input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

export default DonorAuthForm
