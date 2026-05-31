'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { SynthesisScoreCard, SynthesisIssuesPanel } from '@/components/SynthesisPanel'
import { AgentCard } from '@/components/AgentCard'
import { ShareButton } from '@/components/ShareButton'
import { getReviewBySlug, type ReviewDetail } from '@/lib/api'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

const AGENT_NAMES = ['pragmatist', 'paranoid', 'minimalist', 'optimizer', 'mentor'] as const

export default function SharePage() {
  const { slug } = useParams<{ slug: string }>()
  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getReviewBySlug(slug)
      .then(setReview)
      .catch(() => setNotFound(true))
  }, [slug])

  if (notFound) {
    return (
      <>
        <Navbar />
        <main className="pt-16 min-h-dvh bg-canvas flex items-center justify-center">
          <div className="text-center">
            <p className="text-ink font-medium mb-2">Review not found</p>
            <p className="text-sm text-muted mb-6">This link may be invalid or the review is not yet complete.</p>
            <Link href="/" className="btn-primary text-sm">Go home</Link>
          </div>
        </main>
      </>
    )
  }

  if (!review) {
    return (
      <>
        <Navbar />
        <main className="pt-16 min-h-dvh bg-canvas flex items-center justify-center">
          <Loader2 size={24} className="text-muted animate-spin" />
        </main>
      </>
    )
  }

  if (!review.synthesis) {
    return (
      <>
        <Navbar />
        <main className="pt-16 min-h-dvh bg-canvas flex items-center justify-center">
          <p className="text-muted">This review is not yet complete.</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-dvh bg-canvas">
        <div className="container-xl py-12">

          {/* Header */}
          <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
            <div>
              <span className="eyebrow block mb-3">Public review</span>
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                {review.filename ?? review.language}
              </h1>
              <p className="text-sm text-muted mt-1">
                {review.language} &middot; {review.completed_at ? new Date(review.completed_at).toLocaleDateString() : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ShareButton slug={slug} />
              <Link href="/" className="btn-primary text-sm">
                Review my code
              </Link>
            </div>
          </div>

          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-3">
                <p className="eyebrow mb-3">Agent Reviews</p>
                {AGENT_NAMES.map((name) => (
                  <AgentCard key={name} name={name} result={review.agent_results?.[name]} />
                ))}
              </div>
              <div className="lg:sticky lg:top-24">
                <p className="eyebrow mb-3">Final Verdict</p>
                <SynthesisScoreCard synthesis={review.synthesis} />
              </div>
            </div>

            <div>
              <p className="eyebrow mb-4">Findings</p>
              <SynthesisIssuesPanel synthesis={review.synthesis} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
