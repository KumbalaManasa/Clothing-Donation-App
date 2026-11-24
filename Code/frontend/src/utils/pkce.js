import { apiFetch, setAuthToken } from '../api/client.js'

function base64url(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function generateCodeVerifier() {
  const array = new Uint8Array(32)
  window.crypto.getRandomValues(array)
  return base64url(array)
}

export async function computeCodeChallenge(verifier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return base64url(digest)
}

/**
 * Initiates the OAuth 2.0 PKCE flow:
 * 1. Generates code_verifier and code_challenge (S256).
 * 2. Stores code_verifier in sessionStorage (browser memory).
 * 3. Asks backend for the authorization URL.
 * 4. Navigates the browser to the consent screen.
 */
export async function startGoogleLogin() {
  const verifier = generateCodeVerifier()
  const challenge = await computeCodeChallenge(verifier)

  sessionStorage.setItem('pkce_code_verifier', verifier)

  const initData = await apiFetch(
    `/auth/oauth/google/init?code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`
  )

  window.location.href = initData.authUrl
}

/**
 * Exchanges the temporary authorization code + stored code_verifier for an Access Token
 */
export async function exchangeCodeForToken(code, state) {
  const verifier = sessionStorage.getItem('pkce_code_verifier')
  if (!verifier) {
    throw new Error('PKCE code_verifier missing from sessionStorage. Please restart login.')
  }

  const result = await apiFetch('/auth/oauth/google/token', {
    method: 'POST',
    body: {
      code,
      code_verifier: verifier,
      state,
    },
  })

  sessionStorage.removeItem('pkce_code_verifier')
  setAuthToken(result.accessToken || result.token)
  return result
}

