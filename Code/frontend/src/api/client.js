const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

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

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = (data && data.message) || response.statusText
    throw new Error(message)
  }

  return data
}
