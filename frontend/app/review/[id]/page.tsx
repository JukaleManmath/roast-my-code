'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AgentCard } from '@/components/AgentCard'
import { DebateSummaryCard, SynthesisIssuesPanel } from '@/components/SynthesisPanel'
import { ShareButton } from '@/components/ShareButton'
import { getReview, type ReviewDetail, type AgentResult, type Synthesis } from '@/lib/api'
import { ReviewSocket, type TokenUsage } from '@/lib/ws'
import { useAuth, buildGoogleOAuthUrl } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

const AGENT_NAMES = ['pragmatist', 'paranoid', 'minimalist', 'optimizer', 'mentor'] as const

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>()

  const [review, setReview]             = useState<ReviewDetail | null>(null)
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult>>({})
  const [agentTokens, setAgentTokens]   = useState<Record<string, TokenUsage>>({})
  const [synthesis, setSynthesis]       = useState<Synthesis | null>(null)
  const [status, setStatus]             = useState<string>('loading')
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set())

  const seedFromReview = useCallback((r: ReviewDetail) => {
    if (r.agent_results) setAgentResults(r.agent_results)
    if (r.synthesis)     setSynthesis(r.synthesis)
    setStatus(r.status)
  }, [])

  useEffect(() => {
    let socket: ReviewSocket | null = null

    async function init() {
      try {
        const r = await getReview(id)
        setReview(r)
        seedFromReview(r)
        if (r.status === 'done' || r.status === 'failed') return
      } catch {
        setStatus('failed')
        return
      }

      socket = new ReviewSocket(id)
      socket.on((event) => {
        if (event.event === 'pipeline_start') {
          setStatus('running')
          setActiveAgents(new Set(AGENT_NAMES))
        }
        if (event.event === 'agent_done') {
          setAgentResults((prev) => ({ ...prev, [event.agent]: event.result as AgentResult }))
          if (event.tokens_used) {
            setAgentTokens((prev) => ({ ...prev, [event.agent]: event.tokens_used! }))
          }
          setActiveAgents((prev) => { const s = new Set(prev); s.delete(event.agent); return s })
        }
        if (event.event === 'synthesis_done') setSynthesis(event.verdict as Synthesis)
        if (event.event === 'done')  { setStatus('done'); socket?.close() }
        if (event.event === 'error') { setStatus('failed'); socket?.close() }
      })
      socket.connect()
    }

    init()
    return () => socket?.close()
  }, [id, seedFromReview])

  const { user, loading: authLoading } = useAuth()

  const isDone    = status === 'done'
  const isFailed  = status === 'failed'
  const isRunning = status === 'running' || status === 'pending'

  const conflictCount = synthesis?.conflicts?.length ?? 0
  const totalTokens   = Object.values(agentTokens).reduce((sum, t) => sum + t.total, 0) || undefined

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-dvh bg-canvas">
        <div className="container-xl py-12 space-y-10">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink tracking-tight">
                {review?.filename ?? review?.language ?? 'Code Review'}
              </h1>
              <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
                {isRunning && <><Loader2 size={12} className="animate-spin" /> Reviewing…</>}
                {isDone    && 'Review complete'}
                {isFailed  && 'Review failed'}
              </p>
            </div>
            {isDone && review && (
              <div className="flex items-center gap-2">
                <ShareButton slug={review.share_slug} />
              </div>
            )}
          </div>

          {/* Conflict callout — shown when synthesis has conflicts */}
          {isDone && conflictCount > 0 && (
            <div
              className="flex items-center gap-3 rounded-xl px-5 py-3.5"
              style={{ backgroundColor: 'rgb(217 119 6 / 0.08)', border: '1px solid rgb(217 119 6 / 0.25)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
              <p className="text-sm text-amber-700 font-medium">
                {conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'} detected — experts disagree on {conflictCount === 1 ? 'this issue' : 'these issues'}
              </p>
            </div>
          )}

          {/* Sign-in nudge */}
          {isDone && !authLoading && !user && (
            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl px-5 py-4"
              style={{ border: '1px solid var(--border)', backgroundColor: 'rgb(var(--subtle-rgb))' }}
            >
              <div className="flex items-start gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0 mt-0.5">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <div>
                  <p className="text-sm font-medium text-ink">Sign in to save this review</p>
                  <p className="text-xs text-muted mt-0.5">Get review history and a shareable link — free with a Google account.</p>
                </div>
              </div>
              <a
                href={buildGoogleOAuthUrl()}
                className="btn-primary text-sm py-2 px-4 flex items-center gap-2 shrink-0 self-start sm:self-auto"
              >
                <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
                  <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.3 20-21 0-1.4-.2-2.7-.5-4z" fill="#FFC107"/>
                  <path d="M6.3 14.7l7 5.1C15.2 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.3-17.7 11.7z" fill="#FF3D00"/>
                  <path d="M24 45c5.5 0 10.5-1.9 14.4-5.1l-6.6-5.6C29.9 35.9 27.1 37 24 37c-6.1 0-10.7-3.1-11.8-7.5l-7 5.4C8.1 41 15.5 45 24 45z" fill="#4CAF50"/>
                  <path d="M44.5 20H24v8.5h11.8c-.6 2.8-2.4 5.1-4.8 6.6l6.6 5.6C41.5 37.6 45 31.3 45 24c0-1.4-.2-2.7-.5-4z" fill="#1976D2"/>
                </svg>
                Sign in with Google
              </a>
            </div>
          )}

          {/* Main grid: agent cards (2/3) + debate summary (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Agent cards */}
            <div className="lg:col-span-2 space-y-3">
              <p className="text-xs font-medium text-muted mb-3">Agent reviews</p>
              {AGENT_NAMES.map((name) => (
                <AgentCard
                  key={name}
                  name={name}
                  result={agentResults[name]}
                  loading={isRunning || activeAgents.has(name)}
                  tokensUsed={agentTokens[name]}
                />
              ))}
            </div>

            {/* Debate summary — sticky sidebar */}
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-medium text-muted mb-3">Panel verdict</p>
              {synthesis ? (
                <DebateSummaryCard synthesis={synthesis} totalTokens={totalTokens} />
              ) : (
                <div className="card p-6">
                  {isRunning ? (
                    <div className="space-y-3">
                      <div className="h-3 shimmer w-3/4" />
                      <div className="h-3 shimmer w-1/2" />
                      <div className="h-3 shimmer w-2/3" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted text-center">Awaiting synthesis…</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Full-width issue browser */}
          {synthesis && (
            <div>
              <p className="text-xs font-medium text-muted mb-4">Findings</p>
              <SynthesisIssuesPanel synthesis={synthesis} />
            </div>
          )}

        </div>
      </main>
    </>
  )
}
