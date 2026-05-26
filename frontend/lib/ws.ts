const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'

export type WsEvent =
  | { event: 'pipeline_start'; review_id: string }
  | { event: 'agent_done'; agent: string; result: unknown }
  | { event: 'synthesis_done'; verdict: unknown }
  | { event: 'done'; review_id: string }
  | { event: 'error'; message: string }

type Handler = (event: WsEvent) => void

export class ReviewSocket {
  private ws: WebSocket | null = null
  private handlers: Set<Handler> = new Set()
  private shouldReconnect = true
  private reconnectDelay = 1000
  private reviewId: string

  constructor(reviewId: string) {
    this.reviewId = reviewId
  }

  connect() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    const qs = token ? `?token=${token}` : ''
    const url = `${WS_BASE}/ws/reviews/${this.reviewId}/${qs}`

    this.ws = new WebSocket(url)

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WsEvent
        this.handlers.forEach((h) => h(data))
      } catch {
        // ignore malformed frames
      }
    }

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectDelay)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 8000)
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  on(handler: Handler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  close() {
    this.shouldReconnect = false
    this.ws?.close()
  }
}
