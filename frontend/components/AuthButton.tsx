'use client'

import { useEffect, useState } from 'react'
import { getMe, type User } from '@/lib/api'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
const REDIRECT_URI     = 'http://localhost:3000/auth/callback'

function buildGoogleOAuthUrl() {
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

export function AuthButton() {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }

    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('access_token'))
      .finally(() => setLoading(false))
  }, [])

  function handleLogout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  function handleSignIn() {
    window.location.href = buildGoogleOAuthUrl()
  }

  if (loading) {
    return <div className="w-20 h-8 rounded-lg bg-subtle animate-pulse" />
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted hidden sm:block">{user.email}</span>
        <button onClick={handleLogout} className="btn-secondary text-sm py-1.5 px-4">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <button onClick={handleSignIn} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
      <svg width="15" height="15" viewBox="0 0 48 48" fill="none">
        <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.3 20-21 0-1.4-.2-2.7-.5-4z" fill="#FFC107"/>
        <path d="M6.3 14.7l7 5.1C15.2 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.3-17.7 11.7z" fill="#FF3D00"/>
        <path d="M24 45c5.5 0 10.5-1.9 14.4-5.1l-6.6-5.6C29.9 35.9 27.1 37 24 37c-6.1 0-10.7-3.1-11.8-7.5l-7 5.4C8.1 41 15.5 45 24 45z" fill="#4CAF50"/>
        <path d="M44.5 20H24v8.5h11.8c-.6 2.8-2.4 5.1-4.8 6.6l6.6 5.6C41.5 37.6 45 31.3 45 24c0-1.4-.2-2.7-.5-4z" fill="#1976D2"/>
      </svg>
      Sign in with Google
    </button>
  )
}
