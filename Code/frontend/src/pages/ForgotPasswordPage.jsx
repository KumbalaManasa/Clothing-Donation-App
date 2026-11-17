import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client.js'

// Forgot-password entry point, shared across all roles (donor/NGO/admin —
// the backend routes don't care which). Two methods, matching what the user
// picks: 'code' walks them through a second step on this same page; 'link'
// just tells them to check email/phone (or, in local dev, shows the link
// directly — see the dev_code/dev_reset_link fields on the API response,
// which only exist when NODE_ENV !== 'production' server-side).
function ForgotPasswordPage() {
  const [step, setStep] = useState('request') // request | enter-code | link-sent | done
  const [email, setEmail] = useState('')
  const [method, setMethod] = useState('code')
  const [requestError, setRequestError] = useState(null)
  const [requesting, setRequesting] = useState(false)
  const [devCode, setDevCode] = useState(null)
  const [devResetLink, setDevResetLink] = useState(null)

  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetError, setResetError] = useState(null)
  const [resetting, setResetting] = useState(false)

  async function handleRequestSubmit(e) {
    e.preventDefault()
    setRequestError(null)
    setRequesting(true)
    try {
      const result = await apiFetch('/auth/forgot-password', { method: 'POST', body: { email, method } })
      setDevCode(result.dev_code ?? null)
      setDevResetLink(result.dev_reset_link ?? null)
      setStep(method === 'code' ? 'enter-code' : 'link-sent')
    } catch (err) {
      setRequestError(err.message)
    } finally {
      setRequesting(false)
    }
  }

  async function handleCodeResetSubmit(e) {
    e.preventDefault()
    setResetError(null)
    setResetting(true)
    try {
      await apiFetch('/auth/reset-password/code', { method: 'POST', body: { email, code, new_password: newPassword } })
      setStep('done')
    } catch (err) {
      setResetError(err.message)
    } finally {
      setResetting(false)
    }
  }

  if (step === 'done') {
    return (
      <div>
        <h1>Forgot Password</h1>
        <p data-testid="reset-success">Password has been reset. You can now log in.</p>
        <Link to="/">Back to home</Link>
      </div>
    )
  }

  if (step === 'link-sent') {
    return (
      <div>
        <h1>Forgot Password</h1>
        <p>If an account exists for that email, a reset link has been sent to the registered email and phone number.</p>
        {devResetLink && (
          <p>
            Dev mode — use this link directly:{' '}
            <a href={devResetLink} data-testid="dev-reset-link">
              {devResetLink}
            </a>
          </p>
        )}
        <Link to="/">Back to home</Link>
      </div>
    )
  }

  if (step === 'enter-code') {
    return (
      <div>
        <h1>Forgot Password</h1>
        <p>If an account exists for that email, a reset code has been sent to the registered email and phone number.</p>
        {devCode && <p data-testid="dev-code">Dev mode — your code is {devCode}</p>}
        <form data-testid="reset-code-form" onSubmit={handleCodeResetSubmit}>
          <input
            type="text"
            aria-label="Code"
            placeholder="Enter the code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            type="password"
            aria-label="New password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {resetError && <p data-testid="reset-error">{resetError}</p>}
          <button type="submit" disabled={resetting}>
            {resetting ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h1>Forgot Password</h1>
      <form data-testid="forgot-password-form" onSubmit={handleRequestSubmit}>
        <input
          type="email"
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label>
          <input
            type="radio"
            name="method"
            value="code"
            checked={method === 'code'}
            onChange={() => setMethod('code')}
          />
          Send me a code
        </label>
        <label>
          <input
            type="radio"
            name="method"
            value="link"
            checked={method === 'link'}
            onChange={() => setMethod('link')}
          />
          Send me a reset link
        </label>
        {requestError && <p data-testid="forgot-password-error">{requestError}</p>}
        <button type="submit" disabled={requesting}>
          {requesting ? 'Sending...' : 'Send reset instructions'}
        </button>
      </form>
    </div>
  )
}

export default ForgotPasswordPage
