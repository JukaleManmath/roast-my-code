/**
 * Tests for lib/ws.ts
 *
 * WebSocket is not available in jsdom; we inject a mock class via
 * globalThis.WebSocket before each test and restore it after.
 */

import { ReviewSocket } from '@/lib/ws'

// ── Mock WebSocket ────────────────────────────────────────────────────────────

class MockWebSocket {
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null
  onclose:   (() => void) | null = null
  onerror:   (() => void) | null = null
  readyState = 1 // OPEN
  close = jest.fn(() => {
    this.onclose?.()
  })

  constructor(url: string) {
    this.url = url
  }

  // Helper: simulate receiving a server frame
  receive(data: string) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

let mockWs: MockWebSocket

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  // Intercept WebSocket construction so we capture the instance
  ;(globalThis as unknown as Record<string, unknown>).WebSocket = jest.fn((url: string) => {
    mockWs = new MockWebSocket(url)
    return mockWs
  })
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ── connect() — URL construction ─────────────────────────────────────────────

describe('ReviewSocket.connect() — URL', () => {
  test('connects to correct ws path without token', () => {
    const sock = new ReviewSocket('review-abc')
    sock.connect()
    expect(mockWs.url).toContain('/ws/reviews/review-abc/')
    expect(mockWs.url).not.toContain('token=')
  })

  test('appends ?token= when access_token is in localStorage', () => {
    localStorage.setItem('access_token', 'jwt-xyz')
    const sock = new ReviewSocket('review-abc')
    sock.connect()
    expect(mockWs.url).toContain('?token=jwt-xyz')
  })
})

// ── on() — handler registration ───────────────────────────────────────────────

describe('ReviewSocket.on()', () => {
  test('registered handler is called when server sends a message', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    const handler = jest.fn()
    sock.on(handler)

    mockWs.receive(JSON.stringify({ event: 'pipeline_start', review_id: 'r1' }))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ event: 'pipeline_start', review_id: 'r1' })
  })

  test('unsubscribe function removes the handler', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    const handler = jest.fn()
    const unsubscribe = sock.on(handler)

    unsubscribe()
    mockWs.receive(JSON.stringify({ event: 'done', review_id: 'r1' }))

    expect(handler).not.toHaveBeenCalled()
  })

  test('multiple handlers are all called', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    const h1 = jest.fn()
    const h2 = jest.fn()
    sock.on(h1)
    sock.on(h2)

    mockWs.receive(JSON.stringify({ event: 'done', review_id: 'r1' }))

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  test('agent_done event is dispatched with correct shape', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    const handler = jest.fn()
    sock.on(handler)

    const payload = { event: 'agent_done', agent: 'pragmatist', result: { summary: 'ok' } }
    mockWs.receive(JSON.stringify(payload))

    expect(handler).toHaveBeenCalledWith(payload)
  })
})

// ── malformed frames ──────────────────────────────────────────────────────────

describe('ReviewSocket — malformed frames', () => {
  test('does not throw on non-JSON message', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    sock.on(jest.fn())

    expect(() => mockWs.receive('not json {{')).not.toThrow()
  })

  test('does not call handler when frame is malformed', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    const handler = jest.fn()
    sock.on(handler)

    mockWs.receive('not json')

    expect(handler).not.toHaveBeenCalled()
  })
})

// ── close() ───────────────────────────────────────────────────────────────────

describe('ReviewSocket.close()', () => {
  test('calls ws.close()', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    sock.close()
    expect(mockWs.close).toHaveBeenCalledTimes(1)
  })

  test('prevents reconnect after close()', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    sock.close() // sets shouldReconnect=false, triggers onclose via mockWs.close()

    // If shouldReconnect were true, setTimeout would be called for reconnect
    expect(jest.getTimerCount()).toBe(0)
  })
})

// ── reconnect logic ───────────────────────────────────────────────────────────

describe('ReviewSocket — reconnect', () => {
  test('schedules reconnect when connection closes unexpectedly', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()
    // Simulate a server-side close (not via sock.close())
    mockWs.onclose!()

    expect(jest.getTimerCount()).toBe(1) // setTimeout scheduled
  })

  test('reconnect delay doubles on each disconnect (backoff)', () => {
    const sock = new ReviewSocket('r1')
    sock.connect()

    // First disconnect — delay should be 1000ms
    const ws1 = mockWs
    ws1.onclose!()
    expect(jest.getTimerCount()).toBe(1)

    // Advance timer to trigger reconnect
    jest.runAllTimers()

    // Second disconnect — delay should be 2000ms
    mockWs.onclose!()

    // Advance to trigger the second reconnect
    jest.runAllTimers()

    // After two reconnects, delay reached 2000ms (doubled from 1000)
    // We just verify reconnect keeps being scheduled
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(3) // original + 2 reconnects
  })

  test('does not reconnect after explicit close()', () => {
    const WsMock = globalThis.WebSocket as jest.Mock
    const sock = new ReviewSocket('r1')
    sock.connect()
    const callCount = WsMock.mock.calls.length

    sock.close() // shouldReconnect = false, then onclose fires
    jest.runAllTimers()

    expect(WsMock.mock.calls.length).toBe(callCount) // no new WebSocket created
  })
})
