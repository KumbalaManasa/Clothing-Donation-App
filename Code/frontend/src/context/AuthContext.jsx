import { createContext, useContext, useState, useEffect } from 'react'
import { apiFetch, setAuthToken } from '../api/client.js'
import { startGoogleLogin, exchangeCodeForToken } from '../utils/pkce.js'

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
      const token = parsed?.token
      if (token) {
        setAuthToken(token)
      }
      return parsed ? { user: parsed.user || parsed, token } : null
    } catch {
      return null
    }
  })

  // On initial page load:
  // 1. Check if returning from Google OAuth (has ?code= in URL). If so, exchange code + PKCE verifier.
  // 2. Otherwise attempt silent refresh using the HttpOnly refresh_token cookie.
  useEffect(() => {
    let isMounted = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (code) {
      exchangeCodeForToken(code, state)
        .then((res) => {
          if (isMounted && res?.user) {
            const token = res.accessToken || res.token
            persist({ user: res.user, token })
            const returnTo = sessionStorage.getItem('oauth_return_to') || (res.user.role === 'ngo' ? '/ngo' : '/donor')
            sessionStorage.removeItem('oauth_return_to')
            window.history.replaceState({}, document.title, returnTo)
          }
        })
        .catch((err) => {
          console.error('OAuth PKCE exchange error:', err)
        })
      return
    }

    apiFetch('/auth/refresh', { method: 'POST' })
      .then((res) => {
        if (isMounted) {
          const token = res.accessToken || res.token
          setAuthToken(token)
          if (res.user) {
            persist({ user: res.user, token })
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setAuthToken(null)
          setAuth(null)
          localStorage.removeItem(STORAGE_KEY)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  function persist(next) {
    setAuth(next)
    if (next?.user) {
      const token = next.token || auth?.token
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: next.user, token }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // /auth/login returns short-lived accessToken and sets HttpOnly refresh_token cookie
  async function login(email, password) {
    const result = await apiFetch('/auth/login', { method: 'POST', body: { email, password } })
    const token = result.accessToken || result.token
    setAuthToken(token)
    let user = result.user
    if (user.role === 'ngo') {
      const ngoProfile = await apiFetch('/ngo/me')
      user = { ...user, ...ngoProfile }
    }
    persist({ user, token })
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
      // In Type 4: Revokes the refresh token in the DB and clears the HttpOnly cookie
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch (err) {
      console.warn('Logout request completed:', err)
    } finally {
      setAuthToken(null)
      persist(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user: auth?.user ?? null, login, loginWithGoogle: startGoogleLogin, signupDonor, signupNgo, reverifyNgo, logout }}>
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
