import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiFetch, setAuthToken } from './client.js'

function mockFetchOnce(body, { ok = true, status = 200, contentType = 'application/json' } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: 'Error',
    headers: { get: () => contentType },
    json: async () => body,
    text: async () => body,
  })
}

describe('apiFetch', () => {
  beforeEach(() => {
    setAuthToken(null)
  })

  it('calls the correct URL built from the base URL and path', async () => {
    mockFetchOnce({ status: 'ok' })

    await apiFetch('/health')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/health',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('sends Content-Type: application/json and a JSON body when body is provided', async () => {
    mockFetchOnce({ id: '1' })

    await apiFetch('/listings', { method: 'POST', body: { category: 'shirt' } })

    const [, options] = global.fetch.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe(JSON.stringify({ category: 'shirt' }))
  })

  it('omits the Authorization header when no token has been set', async () => {
    mockFetchOnce({ status: 'ok' })

    await apiFetch('/health')

    const [, options] = global.fetch.mock.calls[0]
    expect(options.headers['Authorization']).toBeUndefined()
  })

  it('injects an Authorization: Bearer header once a token is set', async () => {
    mockFetchOnce({ status: 'ok' })
    setAuthToken('test-token-123')

    await apiFetch('/listings/mine')

    const [, options] = global.fetch.mock.calls[0]
    expect(options.headers['Authorization']).toBe('Bearer test-token-123')
  })

  it('parses and returns the JSON response body', async () => {
    mockFetchOnce({ status: 'ok' })

    const result = await apiFetch('/health')

    expect(result).toEqual({ status: 'ok' })
  })

  it('throws with the server message when the response is not ok', async () => {
    mockFetchOnce({ message: 'Not found' }, { ok: false, status: 404 })

    await expect(apiFetch('/listings/missing')).rejects.toThrow('Not found')
  })
})
