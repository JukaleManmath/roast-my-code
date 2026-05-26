'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import type { ReviewSummary } from '@/lib/api'
import { ArrowRight } from 'lucide-react'

interface ReviewHistoryProps {
  reviews: ReviewSummary[]
}

export function ReviewHistory({ reviews }: ReviewHistoryProps) {
  if (reviews.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-muted text-sm">No reviews yet.</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Review some code
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reviews.map((r) => (
        <Link
          key={r.id}
          href={`/review/${r.id}`}
          className="card-hover p-4 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-subtle flex items-center justify-center">
              <span className="text-xs font-mono text-muted uppercase">{r.language.slice(0, 3)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{r.filename ?? r.language}</p>
              <p className="text-xs text-muted mt-0.5 capitalize">
                {r.status} &middot; {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <ArrowRight size={15} className="text-muted shrink-0 group-hover:translate-x-0.5 transition-transform duration-150" />
        </Link>
      ))}
    </div>
  )
}
