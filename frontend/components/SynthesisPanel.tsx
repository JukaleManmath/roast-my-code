'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import type { Synthesis } from '@/lib/api'

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number): { bar: string; text: string; label: string } {
  if (score >= 70) return { bar: '', text: 'text-zinc-600', label: 'Needs rewrite' }
  if (score >= 50) return { bar: '', text: 'text-zinc-600', label: 'Major issues' }
  if (score >= 35) return { bar: '', text: 'text-zinc-600', label: 'Needs work' }
  if (score >= 20) return { bar: '', text: 'text-zinc-600', label: 'Mostly solid' }
  return             { bar: '', text: 'text-zinc-600', label: 'Clean code' }
}

// ── Score card (typographic, no SVG ring) ─────────────────────────────────────

function ScoreDisplay({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(0)
  const [fired, setFired]         = useState(false)
  const { bar, text, grade, label } = scoreColor(score)

  useEffect(() => {
    const delay = setTimeout(() => {
      setFired(true)
      const duration = 1100
      const start = performance.now()
      function step(now: number) {
        const p    = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setDisplayed(Math.round(ease * score))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 80)
    return () => clearTimeout(delay)
  }, [score])


  return (
    <div className="space-y-3">
      {/* Large score + label */}
      <div className="flex items-end gap-3">
        <span className={clsx('text-6xl font-black leading-none tabular-nums', text)}>
          {displayed}
        </span>
        <p className="text-sm text-muted mb-2">{label}</p>
      </div>

      <p className="text-[10px] text-muted/50">0 → clean &nbsp;·&nbsp; 100 → rewrite</p>
    </div>
  )
}

// ── Compact score card (sidebar) ─────────────────────────────────────────────

export function SynthesisScoreCard({ synthesis }: { synthesis: Synthesis }) {
  return (
    <div className="card p-6 animate-slide-up space-y-5">
      <ScoreDisplay score={synthesis.overall_score} />

      {/* Verdict quote block */}
      <div
        className="pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold text-ink mb-2">Verdict</p>
        <p className="text-sm text-muted leading-relaxed">{synthesis.summary}</p>
      </div>

      {(synthesis.critical?.length > 0 || synthesis.warnings?.length > 0 || synthesis.suggestions?.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {synthesis.critical?.length    > 0 && <span className="badge-critical">{synthesis.critical.length} Critical</span>}
          {synthesis.warnings?.length    > 0 && <span className="badge-warning">{synthesis.warnings.length} Warning</span>}
          {synthesis.suggestions?.length > 0 && <span className="badge-suggestion">{synthesis.suggestions.length} Note</span>}
        </div>
      )}
    </div>
  )
}

// ── Full-width tabbed issue browser ──────────────────────────────────────────

type Tab = 'critical' | 'warning' | 'suggestion' | 'conflict'

export function SynthesisIssuesPanel({ synthesis }: { synthesis: Synthesis }) {
  const tabs = ([
    { id: 'critical'   as Tab, label: 'Criticals',   count: synthesis.critical?.length    ?? 0 },
    { id: 'warning'    as Tab, label: 'Warnings',    count: synthesis.warnings?.length    ?? 0 },
    { id: 'suggestion' as Tab, label: 'Suggestions', count: synthesis.suggestions?.length ?? 0 },
    { id: 'conflict'   as Tab, label: 'Conflicts',   count: synthesis.conflicts?.length   ?? 0 },
  ] as const).filter(t => t.count > 0)

  const [active, setActive] = useState<Tab>(tabs[0]?.id ?? 'critical')

  if (tabs.length === 0) return null

  const items =
    active === 'critical'   ? synthesis.critical    :
    active === 'warning'    ? synthesis.warnings    :
    active === 'suggestion' ? synthesis.suggestions : []

  return (
    <div className="animate-slide-up">
      <div className="flex gap-0.5 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg -mb-px',
              active === tab.id
                ? 'text-ink border-b-2 border-ink bg-surface'
                : 'text-muted hover:text-ink',
            )}
          >
            {tab.label}
            <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-semibold', {
              'bg-red-50 text-red-600':       tab.id === 'critical',
              'bg-amber-50 text-amber-700':   tab.id === 'warning',
              'bg-indigo-50 text-indigo-600': tab.id === 'suggestion',
              'bg-subtle text-muted':         tab.id === 'conflict',
            })}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {active !== 'conflict' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items?.map((issue, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start gap-3">
                <span className={clsx('shrink-0 mt-0.5', {
                  'badge-critical':   active === 'critical',
                  'badge-warning':    active === 'warning',
                  'badge-suggestion': active === 'suggestion',
                })}>
                  {active === 'critical' ? 'Critical' : active === 'warning' ? 'Warning' : 'Note'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{issue.title}</p>
                  <p className="text-sm text-muted mt-1 leading-relaxed">{issue.description}</p>
                  {issue.agents && issue.agents.length > 0 && (
                    <p className="text-xs text-muted/50 mt-2">Flagged by {issue.agents.join(', ')}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {active === 'conflict' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {synthesis.conflicts?.map((conflict, i) => (
            <div key={i} className="card p-4">
              <p className="text-sm font-semibold text-ink mb-3">{conflict.topic}</p>
              <div className="space-y-2">
                {Object.entries(conflict.positions).map(([agent, position]) => (
                  <div key={agent} className="flex gap-2 text-sm">
                    <span className="text-ink font-medium capitalize shrink-0">{agent}:</span>
                    <span className="text-muted">{position as string}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
