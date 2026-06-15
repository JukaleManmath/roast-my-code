'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { Synthesis } from '@/lib/api'

// ── Debate summary card (replaces score card) ─────────────────────────────────

export function DebateSummaryCard({ synthesis, totalTokens }: { synthesis: Synthesis; totalTokens?: number }) {
  const conflictCount    = synthesis.conflicts?.length    ?? 0
  const criticalCount    = synthesis.critical?.length     ?? 0
  const warningCount     = synthesis.warnings?.length     ?? 0
  const suggestionCount  = synthesis.suggestions?.length  ?? 0
  const total = conflictCount + criticalCount + warningCount + suggestionCount

  return (
    <div className="card p-6 animate-slide-up space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted">Panel summary</p>
          {totalTokens && (
            <span className="text-[10px] font-mono text-muted/50">
              {(totalTokens / 1000).toFixed(1)}K tokens
            </span>
          )}
        </div>
        <p className="text-sm text-muted leading-relaxed">{synthesis.summary}</p>
      </div>

      {total > 0 && (
        <div className="space-y-2.5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          {conflictCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-600 font-medium">Experts disagree</span>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {conflictCount}
              </span>
            </div>
          )}
          {criticalCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Critical consensus</span>
              <span className="badge-critical">{criticalCount}</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Warnings</span>
              <span className="badge-warning">{warningCount}</span>
            </div>
          )}
          {suggestionCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Notes</span>
              <span className="badge-suggestion">{suggestionCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Full-width tabbed issue browser ──────────────────────────────────────────

type Tab = 'critical' | 'warning' | 'suggestion' | 'conflict'

export function SynthesisIssuesPanel({ synthesis }: { synthesis: Synthesis }) {
  const tabs = ([
    { id: 'conflict'   as Tab, label: 'Conflicts',   count: synthesis.conflicts?.length   ?? 0 },
    { id: 'critical'   as Tab, label: 'Criticals',   count: synthesis.critical?.length    ?? 0 },
    { id: 'warning'    as Tab, label: 'Warnings',    count: synthesis.warnings?.length    ?? 0 },
    { id: 'suggestion' as Tab, label: 'Suggestions', count: synthesis.suggestions?.length ?? 0 },
  ] as const).filter(t => t.count > 0)

  // Default to Conflicts tab when conflicts exist, otherwise first tab
  const defaultTab = tabs.find(t => t.id === 'conflict')?.id ?? tabs[0]?.id ?? 'critical'
  const [active, setActive] = useState<Tab>(defaultTab as Tab)

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
              'bg-amber-50 text-amber-700':   tab.id === 'conflict' || tab.id === 'warning',
              'bg-red-50 text-red-600':       tab.id === 'critical',
              'bg-indigo-50 text-indigo-600': tab.id === 'suggestion',
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
            <div key={i} className="card p-4" style={{ borderLeft: '3px solid rgb(217 119 6 / 0.6)' }}>
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
