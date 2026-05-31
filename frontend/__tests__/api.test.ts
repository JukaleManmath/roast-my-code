/**
 * Tests for lib/api.ts
 *
 * Strategy: mock globalThis.fetch so no real network calls happen.
 * localStorage is available in jsdom; we set/clear it per test.
 */

import { ApiError, getPdfUrl, submitReview, getReview, deleteReview, getHistory } from '@/lib/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, ok = status < 400) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response)
}

function setToken(token: string | null) {
  if (token === null) {
    localStorage.removeItem('access_token')
  } else {
    localStorage.setItem('access_token', token)
  }
}

beforeEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
})

// ── ApiError ─────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  test('has name "ApiError"', () => {
    const err = new ApiError(400, 'Bad request')
    expect(err.name).toBe('ApiError')
  })

  test('stores status and message', () => {
    const err = new ApiError(422, 'Unprocessable')
    expect(err.status).toBe(422)
    expect(err.message).toBe('Unprocessable')
  })

  test('is instanceof Error', () => {
    expect(new ApiError(500, 'oops')).toBeInstanceOf(Error)
  })
})

// ── request() internals (via submitReview as a proxy) ────────────────────────

describe('request() — auth header', () => {
  test('attaches Bearer token when access_token is in localStorage', async () => {
    setToken('my-jwt-token')
    mockFetch(201, { id: 'abc-123' })

    await submitReview({ input_mode: 'paste', code: 'x=1', language: 'Python' })

    const [, options] = (fetch as jest.Mock).mock.calls[0]
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token')
  })

  test('omits Authorization header when no token', async () => {
    setToken(null)
    mockFetch(201, { id: 'abc-123' })

    await submitReview({ input_mode: 'paste', code: 'x=1', language: 'Python' })

    const [, options] = (fetch as jest.Mock).mock.calls[0]
    expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })
})

describe('request() — error handling', () => {
  test('throws ApiError with detail message on 400', async () => {
    mockFetch(400, { detail: 'Code too short.' }, false)

    await expect(
      submitReview({ input_mode: 'paste', code: 'x', language: 'Python' })
    ).rejects.toMatchObject({ name: 'ApiError', status: 400, message: 'Code too short.' })
  })

  test('uses first element of array error body', async () => {
    mockFetch(400, ['First error message.'], false)

    await expect(
      submitReview({ input_mode: 'paste', code: 'x', language: 'Python' })
    ).rejects.toMatchObject({ message: 'First error message.' })
  })

  test('falls back to HTTP status string when body has no detail', async () => {
    mockFetch(500, {}, false)

    await expect(
      submitReview({ input_mode: 'paste', code: 'x', language: 'Python' })
    ).rejects.toMatchObject({ message: 'HTTP 500' })
  })

  test('throws ApiError on 404', async () => {
    mockFetch(404, { detail: 'Not found.' }, false)

    await expect(getReview('bad-id')).rejects.toMatchObject({ status: 404 })
  })
})

describe('request() — 204 No Content', () => {
  test('returns undefined for 204 responses', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: jest.fn(),
    } as unknown as Response)

    const result = await deleteReview('some-id')
    expect(result).toBeUndefined()
  })
})

// ── submitReview ──────────────────────────────────────────────────────────────

describe('submitReview()', () => {
  test('sends POST to /api/reviews/', async () => {
    mockFetch(201, { id: 'rev-1' })

    await submitReview({ input_mode: 'paste', code: 'x=1', language: 'Python' })

    const [url, options] = (fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/reviews/')
    expect(options.method).toBe('POST')
  })

  test('serialises payload as JSON', async () => {
    mockFetch(201, { id: 'rev-1' })
    const payload = { input_mode: 'paste' as const, code: 'x=1', language: 'Python' }

    await submitReview(payload)

    const [, options] = (fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(options.body as string)).toMatchObject(payload)
  })

  test('returns the id from the response', async () => {
    mockFetch(201, { id: 'rev-42' })
    const result = await submitReview({ input_mode: 'paste', code: 'x=1', language: 'Python' })
    expect(result.id).toBe('rev-42')
  })
})

// ── getHistory ────────────────────────────────────────────────────────────────

describe('getHistory()', () => {
  test('sends GET to /api/reviews/history/', async () => {
    mockFetch(200, [])
    await getHistory()
    const [url] = (fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/reviews/history/')
  })
})

// ── getPdfUrl ─────────────────────────────────────────────────────────────────

describe('getPdfUrl()', () => {
  test('includes token as query param when token exists', () => {
    setToken('tok-abc')
    const url = getPdfUrl('rev-999')
    expect(url).toContain('/api/reviews/rev-999/pdf/')
    expect(url).toContain('?token=tok-abc')
  })

  test('no query string when no token', () => {
    setToken(null)
    const url = getPdfUrl('rev-999')
    expect(url).toContain('/api/reviews/rev-999/pdf/')
    expect(url).not.toContain('?token=')
  })
})
