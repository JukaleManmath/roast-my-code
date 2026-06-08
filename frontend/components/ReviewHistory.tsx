'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReviewSummary } from '@/lib/api'
import { ArrowRight, Trash2 } from 'lucide-react'

function reviewTitle(r: ReviewSummary): string {
  if (r.input_mode === 'file' && r.filename) return r.filename
  if (r.input_mode === 'github' && r.github_url) {
    try {
      const parts = new URL(r.github_url).pathname.split('/').filter(Boolean)
      return parts[parts.length - 1] ?? r.github_url
    } catch {
      return r.github_url
    }
  }
  return `${r.language} snippet`
}

function reviewSubtitle(r: ReviewSummary): string {
  const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const mode = r.input_mode === 'github' ? 'GitHub' : r.input_mode === 'file' ? 'File upload' : 'Pasted'
  const status = r.status.charAt(0).toUpperCase() + r.status.slice(1)
  return `${mode} · ${status} · ${date}`
}

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
              <p className="text-sm font-medium text-ink truncate">{reviewTitle(r)}</p>
              <p className="text-xs text-muted mt-0.5">{reviewSubtitle(r)}</p>
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
                <Link href={`/review/${r.id}`} className="p-1.5 rounded-lg text-muted hover:text-ink transition-colors duration-150">
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform duration-150" />
                </Link>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
