// Defaults to whatever host the page itself was loaded from (same hostname,
// backend's port) instead of a hardcoded 'localhost' — so this keeps working
// unchanged whether the page is opened as localhost, a LAN IP (sharing the
// app with others on the same network), or eventually a real domain, with
// no per-environment config needed. VITE_API_BASE_URL still overrides this
// explicitly when the backend genuinely lives somewhere else. `window` isn't
// defined in vitest's Node test environment, so fall back to 'localhost' there.
//
// Protocol also matches the page's own (http/https) rather than being
// hardcoded to http — when the frontend is served over https (self-signed
// LAN dev cert, see Code/certs/), an http:// fetch from an https:// page is
// blocked outright as mixed content, so the backend must be reached over
// https too whenever the page itself is.
const defaultHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const defaultProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
const isNginxPort = typeof window !== 'undefined' && (!window.location.port || window.location.port === '443' || window.location.port === '80')
const BASE_URL = import.meta.env.VITE_API_BASE_URL || (isNginxPort ? '/api' : `${defaultProtocol}//${defaultHostname}:4000`)

// Photo URLs from the backend are either absolute (Cloudinary, Task 13B) or a
// relative /uploads/... path (local storage driver, Task 13A) — resolve the
// latter against the API origin so <img> tags work regardless of which
// storage driver is active server-side.
export function resolveAssetUrl(url) {
  if (!url) return url
  return /^https?:\/\//.test(url) ? url : (isNginxPort ? url : `${BASE_URL}${url}`)
}

let authToken = null

// Auth header injection point (LLD §3: endpoints expect a Firebase Auth bearer token).
export function setAuthToken(token) {
  authToken = token
}

export async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
  }
  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`
  }

  // credentials: 'include' ensures browsers send and store the `sid` session cookie
  // both for same-origin (nginx) and cross-origin (direct port 5173 -> 4000) calls.
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = (data && data.message) || response.statusText
    throw new Error(message)
  }

  return data
}
