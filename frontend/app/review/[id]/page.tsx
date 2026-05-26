'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AgentCard } from '@/components/AgentCard'
import { SynthesisPanel } from '@/components/SynthesisPanel'
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
        <div className="container-xl py-12">

          {/* Header */}
          <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
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

          {/* Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent cards */}
            <div className="lg:col-span-2 space-y-4">
              <p className="eyebrow">Agent Reviews</p>
              {AGENT_NAMES.map((name) => (
                <AgentCard
                  key={name}
                  name={name}
                  result={agentResults[name]}
                  loading={isRunning || activeAgents.has(name)}
                />
              ))}
            </div>

            {/* Synthesis */}
            <div>
              <p className="eyebrow mb-4">Final Verdict</p>
              {synthesis ? (
                <SynthesisPanel synthesis={synthesis} />
              ) : (
                <div className="card p-8 text-center">
                  {isRunning ? (
                    <div className="space-y-3">
                      <div className="h-3 shimmer w-3/4 mx-auto" />
                      <div className="h-3 shimmer w-1/2 mx-auto" />
                      <div className="h-3 shimmer w-2/3 mx-auto" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Awaiting synthesis…</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
