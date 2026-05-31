'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReviewSummary } from '@/lib/api'
import { ArrowRight, Trash2 } from 'lucide-react'

interface ReviewHistoryProps {
  reviews: ReviewSummary[]
  onDelete: (id: string) => void
}

export function ReviewHistory({ reviews, onDelete }: ReviewHistoryProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)

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
        <div
          key={r.id}
          className="card-hover p-4 flex items-center justify-between group"
        >
          <Link
            href={`/review/${r.id}`}
            className="flex items-center gap-4 min-w-0 flex-1"
          >
            <div className="shrink-0 w-10 h-10 rounded-xl bg-subtle flex items-center justify-center">
              <span className="text-xs font-mono text-muted uppercase">{r.language.slice(0, 3)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{r.filename ?? r.language}</p>
              <p className="text-xs text-muted mt-0.5 capitalize">
                {r.status} &middot; {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0 ml-3">
            {pendingId === r.id ? (
              <>
                <button
                  onClick={() => { onDelete(r.id); setPendingId(null) }}
                  className="text-xs font-medium text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors duration-150"
                >
                  Delete
                </button>
                <button
                  onClick={() => setPendingId(null)}
                  className="text-xs font-medium text-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-subtle transition-colors duration-150"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setPendingId(r.id)}
                  className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors duration-150"
                  aria-label="Delete review"
                >
                  <Trash2 size={14} />
                </button>
                <ArrowRight size={15} className="text-muted group-hover:translate-x-0.5 transition-transform duration-150" />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
