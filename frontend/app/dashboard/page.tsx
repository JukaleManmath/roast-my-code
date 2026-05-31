'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ReviewHistory } from '@/components/ReviewHistory'
import { deleteReview, getHistory, getMe, type ReviewSummary } from '@/lib/api'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [reviews, setReviews] = useState<ReviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed]   = useState(false)

  async function handleDelete(id: string) {
    await deleteReview(id)
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.replace('/'); return }

    getMe()
      .then(() => { setAuthed(true); return getHistory() })
      .then(setReviews)
      .catch(() => router.replace('/'))
      .finally(() => setLoading(false))
  }, [router])

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-dvh bg-canvas">
        <div className="container-xl py-12 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Your reviews</h1>
          <p className="text-muted mb-10">All code reviews tied to your account.</p>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={24} className="text-muted animate-spin" />
            </div>
          ) : authed ? (
            <ReviewHistory reviews={reviews} onDelete={handleDelete} />
          ) : null}
        </div>
      </main>
    </>
  )
}
