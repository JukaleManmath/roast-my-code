'use client'

import { useEffect, useState } from 'react'
import { getMe, type User } from './api'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
const REDIRECT_URI     = process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback'

export function buildGoogleOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    if (!token) { setLoading(false); return }

    getMe()
      .then(setUser)
      .catch(() => sessionStorage.removeItem('access_token'))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading }
}
