const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
    const body = await res.json().catch(() => ({}))
    const message = Array.isArray(body)
      ? body[0]
      : body?.detail ?? `HTTP ${res.status}`
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function getMe() {
  return request<User>('/api/auth/me/')
}

// ── Reviews ─────────────────────────────────────────────────────────────────

export type InputMode = 'paste' | 'file' | 'github'

export interface SubmitPayload {
  input_mode: InputMode
  code?: string
  filename?: string
  github_url?: string
  language?: string
}

export interface ReviewSummary {
  id: string
  status: string
  language: string
  filename: string | null
  share_slug: string
  created_at: string
  completed_at: string | null
}

export interface Issue {
  title: string
  description: string
  agents?: string[]
  severity?: 'critical' | 'warning' | 'suggestion'
  line_hint?: string
}

export interface Conflict {
  topic: string
  positions: Record<string, string>
}

export interface Synthesis {
  overall_score: number
  summary: string
  critical: Issue[]
  warnings: Issue[]
  suggestions: Issue[]
  conflicts: Conflict[]
}

export interface AgentResult {
  summary: string
  issues: Issue[]
}

export interface ReviewDetail extends ReviewSummary {
  synthesis: Synthesis | null
  agent_results: Record<string, AgentResult> | null
  event_log: unknown[]
}

export interface User {
  id: string
  email: string
  display_name: string
}

export function submitReview(payload: SubmitPayload) {
  return request<{ id: string }>('/api/reviews/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function submitFileReview(file: File, language?: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('input_mode', 'file')
  if (language) form.append('language', language)

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  return fetch(`${API_BASE}/api/reviews/`, {
    method: 'POST',
    headers,
    body: form,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(res.status, body?.detail ?? `HTTP ${res.status}`)
    }
    return res.json() as Promise<{ id: string }>
  })
}

export function getReview(id: string) {
  return request<ReviewDetail>(`/api/reviews/${id}/`)
}

export function getReviewBySlug(slug: string) {
  return request<ReviewDetail>(`/api/r/${slug}/`)
}

export function getHistory() {
  return request<ReviewSummary[]>('/api/reviews/history/')
}

export function deleteReview(id: string) {
  return request<void>(`/api/reviews/${id}/`, { method: 'DELETE' })
}

export function saveReview(reviewId: string) {
  return request<void>('/api/reviews/save/', {
    method: 'POST',
    body: JSON.stringify({ review_id: reviewId }),
  })
}

export function getPdfUrl(reviewId: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const qs = token ? `?token=${token}` : ''
  return `${API_BASE}/api/reviews/${reviewId}/pdf/${qs}`
}
