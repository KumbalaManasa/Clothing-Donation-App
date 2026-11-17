import { createContext, useContext, useState } from 'react'
import { apiFetch, setAuthToken } from '../api/client.js'

const AuthContext = createContext(null)
const STORAGE_KEY = 'donation-app.auth'

// General-purpose auth (not donor-specific) — every role (donor, ngo, admin)
// will need login eventually; only the donor login/signup form (a prerequisite
// for task 9.4, since no task builds one) is wired up to use it right now.
// Session persists in localStorage so a page reload doesn't immediately log
// the user out — LLD §3's bearer-token sessions are stateless, so this is
// purely a client-side convenience, not a security boundary.
export function AuthProvider({ children }) {
  // setAuthToken runs here (during the synchronous render phase), not in a
  // useEffect: effects fire children-first, so a child that fetches on mount
  // (e.g. MyListingsPage) would otherwise run before this provider's own
  // effect had set the token, sending that first request unauthenticated.
  const [auth, setAuth] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) : null
      setAuthToken(parsed?.token ?? null)
      return parsed
    } catch {
      return null
    }
  })

  // persist() sets the module-level auth token synchronously, before calling
  // setAuth(): a state update can mount new authenticated-only children
  // (e.g. BrowseListings right after NGO signup) in the same commit, and
  // child effects fire before this provider's own effects, so leaving the
  // token update to a useEffect here would race that child's on-mount fetch.
  function persist(next) {
    setAuthToken(next?.token ?? null)
    setAuth(next)
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // /auth/login's user payload doesn't carry role-specific fields (task 10.1's
  // note) — an NGO's verification_status is fetched separately here via
  // GET /ngo/me (task 10.2) so a returning NGO sees its current status, not
  // just one that just signed up. setAuthToken is called directly first since
  // that /ngo/me call itself needs the token applied.
  async function login(email, password) {
    const result = await apiFetch('/auth/login', { method: 'POST', body: { email, password } })
    let user = result.user
    if (user.role === 'ngo') {
      setAuthToken(result.token)
      const ngoProfile = await apiFetch('/ngo/me')
      user = { ...user, ...ngoProfile }
    }
    persist({ token: result.token, user })
  }

  // POST /auth/signup/donor (LLD §3.1) doesn't itself return a session token
  // — only /auth/login does — so signup immediately logs in afterward with
  // the same credentials.
  async function signupDonor({ name, email, phone, password }) {
    await apiFetch('/auth/signup/donor', { method: 'POST', body: { name, email, phone, password } })
    await login(email, password)
  }

  // POST /auth/signup/ngo (LLD §3.1, spec.md §6.3) returns verification_status
  // directly (no 'pending' state), but /auth/login's user payload doesn't
  // carry it — so the signup response's org/verification fields are merged
  // into the logged-in user here, letting the caller show verified/not_verified
  // immediately without a second round trip (task 10.1's verify criterion).
  async function signupNgo({ name, email, phone, password, orgName, registrationNumber }) {
    const signupResult = await apiFetch('/auth/signup/ngo', {
      method: 'POST',
      body: { name, email, phone, password, org_name: orgName, registration_number: registrationNumber },
    })
    const loginResult = await apiFetch('/auth/login', { method: 'POST', body: { email, password } })
    persist({
      token: loginResult.token,
      user: {
        ...loginResult.user,
        org_name: signupResult.org_name,
        registration_number: signupResult.registration_number,
        verification_status: signupResult.verification_status,
      },
    })
  }

  // Edit-registration-number-and-resubmit action (task 10.2), wired to
  // POST /ngo/:id/reverify. Merges the response (updated registration_number
  // + fresh verification_status) into the current user so the UI flips to
  // "verified" in place, without a fresh signup or re-login.
  async function reverifyNgo(registrationNumber) {
    const updated = await apiFetch(`/ngo/${auth.user.id}/reverify`, {
      method: 'POST',
      body: { registration_number: registrationNumber },
    })
    persist({ token: auth.token, user: { ...auth.user, ...updated } })
  }

  function logout() {
    persist(null)
  }

  return (
    <AuthContext.Provider value={{ user: auth?.user ?? null, login, signupDonor, signupNgo, reverifyNgo, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
