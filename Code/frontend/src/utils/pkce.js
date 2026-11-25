import { apiFetch, resolveAssetUrl, setAuthToken } from '../api/client.js'

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
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(32)
    window.crypto.getRandomValues(array)
    return base64url(array)
  }
  let result = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function computeCodeChallenge(verifier) {
  // In secure contexts (HTTPS or localhost), SubtleCrypto is available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(verifier)
      const digest = await window.crypto.subtle.digest('SHA-256', data)
      return { challenge: base64url(digest), method: 'S256' }
    } catch {
      // Fallback below
    }
  }
  // In non-secure contexts (e.g. plain HTTP over public IP like http://18.60.148.150),
  // browsers deliberately disable window.crypto.subtle.
  // Fall back to RFC 7636 'plain' method so Google sign-in works seamlessly on plain HTTP!
  return { challenge: verifier, method: 'plain' }
}

/**
 * Initiates the OAuth 2.0 PKCE flow:
 * 1. Generates code_verifier and code_challenge (S256 or plain).
 * 2. Stores code_verifier in sessionStorage (browser memory).
 * 3. Asks backend for the authorization URL.
 * 4. Navigates the browser to the consent screen.
 */
export async function startGoogleLogin() {
  const verifier = generateCodeVerifier()
  const { challenge, method } = await computeCodeChallenge(verifier)

  sessionStorage.setItem('pkce_code_verifier', verifier)
  sessionStorage.setItem('oauth_return_to', window.location.pathname)

  const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname)

  const initData = await apiFetch(
    `/auth/oauth/google/init?code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=${encodeURIComponent(method)}&return_url=${returnUrl}`
  )

  const targetUrl = resolveAssetUrl(initData.authUrl)
  window.location.href = targetUrl
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

