import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Minimal donor login/signup — a prerequisite for task 9.4 (submitting a
// listing needs a real authenticated session), since no task in Spec/tasks.md
// builds one. Calls the already-built POST /auth/signup/donor and
// POST /auth/login (LLD §3.1).
function DonorAuthForm() {
  const { login, signupDonor, loginWithGoogle } = useAuth()
  const [mode, setMode] = useState('login') // login | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleLogin() {
    setError(null)
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err.message || 'Unable to connect to Google sign-in. Please ensure the backend is running.')
      setGoogleLoading(false)
    }
  }

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

      <div style={{ margin: '14px 0', borderTop: '1px solid #e2e8f0', paddingTop: '14px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            gap: '10px',
            backgroundColor: '#ffffff',
            color: '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '6px',
            padding: '10px 16px',
            cursor: googleLoading ? 'wait' : 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            boxShadow: '0 1px 2px rgba(60,64,67,0.1)',
            transition: 'background-color 0.2s, box-shadow 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!googleLoading) {
              e.currentTarget.style.backgroundColor = '#f8fafd'
              e.currentTarget.style.borderColor = '#c2e7ff'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(60,64,67,0.2)'
            }
          }}
          onMouseLeave={(e) => {
            if (!googleLoading) {
              e.currentTarget.style.backgroundColor = '#ffffff'
              e.currentTarget.style.borderColor = '#dadce0'
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.1)'
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {googleLoading ? 'Signing in with Google...' : 'Sign in with Google'}
        </button>
      </div>
      <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
      </button>
      {mode === 'login' && <Link to="/forgot-password">Forgot password?</Link>}
    </form>
  )
}

export default DonorAuthForm
