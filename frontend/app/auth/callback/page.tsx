'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function AuthCallback() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const didFetch = useRef(false)

  useEffect(() => {
    // React StrictMode mounts effects twice in development.
    // Guard against sending the auth code to Google twice — codes are single-use.
    if (didFetch.current) return
    didFetch.current = true

    const code  = searchParams.get('code')
    const state = searchParams.get('error')

    if (state === 'access_denied') {
      router.replace('/')
      return
    }

    if (!code) {
      setError('No authorization code received from Google.')
      return
    }

    fetch(`${API_BASE}/api/auth/social/google/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback',
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? body?.non_field_errors?.[0] ?? `Auth failed (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        // Store only the short-lived access token in sessionStorage (cleared on tab close).
        // The refresh token is intentionally not stored client-side — XSS risk.
        sessionStorage.setItem('access_token', data.access)
        router.replace('/')
      })
      .catch((err: Error) => {
        setError(err.message)
      })
  }, [searchParams, router])

  if (error) {
    return (
      <main className="min-h-dvh bg-canvas flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-600">{error}</p>
        <a href="/" className="btn-primary text-sm">Go home</a>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-canvas flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={22} className="animate-spin text-muted" />
        <p className="text-sm text-muted">Signing you in…</p>
      </div>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh bg-canvas flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-muted" />
      </main>
    }>
      <AuthCallback />
    </Suspense>
  )
}
