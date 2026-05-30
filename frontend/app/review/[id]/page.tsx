'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AgentCard } from '@/components/AgentCard'
import { SynthesisScoreCard, SynthesisIssuesPanel } from '@/components/SynthesisPanel'
import { ShareButton } from '@/components/ShareButton'
import { DownloadPDF } from '@/components/DownloadPDF'
import { getReview, type ReviewDetail, type AgentResult, type Synthesis } from '@/lib/api'
import { ReviewSocket } from '@/lib/ws'
import { Loader2 } from 'lucide-react'

const AGENT_NAMES = ['pragmatist', 'paranoid', 'minimalist', 'optimizer', 'mentor'] as const

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>()

  const [review, setReview]             = useState<ReviewDetail | null>(null)
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult>>({})
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

  const isDone    = status === 'done'
  const isFailed  = status === 'failed'
  const isRunning = status === 'running' || status === 'pending'

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
                <DownloadPDF reviewId={id} />
              </div>
            )}
          </div>

          {/* Main grid: agent cards (2/3) + score card (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Agent cards */}
            <div className="lg:col-span-2 space-y-3">
              <p className="eyebrow mb-3">Agent Reviews</p>
              {AGENT_NAMES.map((name) => (
                <AgentCard
                  key={name}
                  name={name}
                  result={agentResults[name]}
                  loading={isRunning || activeAgents.has(name)}
                />
              ))}
            </div>

            {/* Score card — compact sidebar */}
            <div className="lg:sticky lg:top-24">
              <p className="eyebrow mb-3">Final Verdict</p>
              {synthesis ? (
                <SynthesisScoreCard synthesis={synthesis} />
              ) : (
                <div className="card p-6">
                  {isRunning ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-24 h-24 rounded-full shimmer" />
                      <div className="w-full space-y-2">
                        <div className="h-3 shimmer w-3/4 mx-auto" />
                        <div className="h-3 shimmer w-1/2 mx-auto" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted text-center">Awaiting synthesis…</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Full-width issue browser — only when synthesis is ready */}
          {synthesis && (
            <div>
              <p className="eyebrow mb-4">Findings</p>
              <SynthesisIssuesPanel synthesis={synthesis} />
            </div>
          )}

        </div>
      </main>
    </>
  )
}
