import { createContext, useContext, useState, useEffect } from 'react'
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
      // In Type 3: Token is stored securely in an HttpOnly cookie, not in localStorage.
      // localStorage only caches non-sensitive user profile info for instant rendering.
      setAuthToken(null)
      return parsed ? { user: parsed.user || parsed } : null
    } catch {
      return null
    }
  })

  // Validate active session with backend on load. If the HttpOnly cookie is valid,
  // ensure the latest user profile is populated. If invalid/expired, clear local state.
  useEffect(() => {
    let isMounted = true
    apiFetch('/auth/me')
      .then((res) => {
        if (isMounted && res?.user) {
          setAuth((prev) => ({
            ...prev,
            user: { ...prev?.user, ...res.user },
          }))
        }
      })
      .catch(() => {
        // If the cookie was cleared or expired, reset state
        if (isMounted && auth) {
          persist(null)
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  function persist(next) {
    // In Type 3: We deliberately do NOT store the JWT token in JavaScript or localStorage.
    // The browser automatically stores and attaches the HttpOnly cookie.
    setAuthToken(null)
    setAuth(next)
    if (next?.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: next.user }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // /auth/login sets the HttpOnly cookie automatically.
  async function login(email, password) {
    const result = await apiFetch('/auth/login', { method: 'POST', body: { email, password } })
    let user = result.user
    if (user.role === 'ngo') {
      const ngoProfile = await apiFetch('/ngo/me')
      user = { ...user, ...ngoProfile }
    }
    persist({ user })
  }

  // POST /auth/signup/donor immediately logs in afterward.
  async function signupDonor({ name, email, phone, password }) {
    await apiFetch('/auth/signup/donor', { method: 'POST', body: { name, email, phone, password } })
    await login(email, password)
  }

  async function signupNgo({ name, email, phone, password, orgName, registrationNumber }) {
    const signupResult = await apiFetch('/auth/signup/ngo', {
      method: 'POST',
      body: { name, email, phone, password, org_name: orgName, registration_number: registrationNumber },
    })
    const loginResult = await apiFetch('/auth/login', { method: 'POST', body: { email, password } })
    persist({
      user: {
        ...loginResult.user,
        org_name: signupResult.org_name,
        registration_number: signupResult.registration_number,
        verification_status: signupResult.verification_status,
      },
    })
  }

  async function reverifyNgo(registrationNumber) {
    const updated = await apiFetch(`/ngo/${auth.user.id}/reverify`, {
      method: 'POST',
      body: { registration_number: registrationNumber },
    })
    persist({ user: { ...auth.user, ...updated } })
  }

  async function logout() {
    try {
      // In Type 3: Calls backend to clear the HttpOnly cookie (Max-Age=0)
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch (err) {
      console.warn('Logout request completed:', err)
    } finally {
      persist(null)
    }
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
