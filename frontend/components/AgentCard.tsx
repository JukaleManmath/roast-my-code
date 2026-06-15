'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { AgentResult } from '@/lib/api'
import type { TokenUsage } from '@/lib/ws'

const AGENT_META: Record<string, { label: string; description: string }> = {
  pragmatist: { label: 'Staff Backend Engineer',     description: 'Production concerns and real-world maintainability' },
  paranoid:   { label: 'Penetration Tester',         description: 'Security vulnerabilities and attack surface' },
  minimalist: { label: 'Clean Code Evangelist',      description: 'Unnecessary complexity and readability issues' },
  optimizer:  { label: 'Performance Engineer',       description: 'Bottlenecks, memory waste, and scaling problems' },
  mentor:     { label: 'Senior Onboarding Engineer', description: 'Clarity and safety for the next person in the code' },
}

interface AgentCardProps {
  name: string
  result?: AgentResult
  loading?: boolean
  tokensUsed?: TokenUsage
}

export function AgentCard({ name, result, loading, tokensUsed }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const meta = AGENT_META[name] ?? { label: name, description: '' }
  const done = !!result

  const counts = done && result?.issues ? {
    critical:   result.issues.filter(i => i.severity === 'critical').length,
    warning:    result.issues.filter(i => i.severity === 'warning').length,
    suggestion: result.issues.filter(i => !i.severity || i.severity === 'suggestion').length,
  } : null

  return (
    <div className={clsx(
      'card transition-all duration-300',
      done ? 'animate-slide-up' : 'opacity-50',
    )}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{meta.label}</p>
            <p className="text-xs text-muted mt-0.5">{meta.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tokensUsed && (
              <span className="text-[10px] text-muted/50 font-mono">
                {(tokensUsed.total / 1000).toFixed(1)}K tok
              </span>
            )}
            {loading && !done && <Loader2 size={15} className="text-muted animate-spin" />}
            {done    && <CheckCircle2 size={15} className="text-ink/30" />}
          </div>
        </div>

        {/* Skeleton */}
        {!done && (
          <div className="space-y-2 mt-4">
            <div className="h-3 shimmer w-4/5" />
            <div className="h-3 shimmer w-3/5" />
          </div>
        )}

        {/* Summary as quote block + count badges */}
        {done && (
          <div className="mt-3 space-y-3">
            {result?.summary && (
              <p className="text-sm text-muted leading-relaxed">{result.summary}</p>
            )}
            {counts && (counts.critical + counts.warning + counts.suggestion) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {counts.critical   > 0 && <span className="badge-critical">{counts.critical} critical</span>}
                {counts.warning    > 0 && <span className="badge-warning">{counts.warning} warning</span>}
                {counts.suggestion > 0 && <span className="badge-suggestion">{counts.suggestion} note</span>}
              </div>
            )}
            {(!result?.issues || result.issues.length === 0) && (
              <p className="text-sm text-muted italic">No issues found.</p>
            )}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      {done && result?.issues && result.issues.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted hover:text-ink hover:bg-subtle/50 transition-colors"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span>{expanded ? 'Hide issues' : `View ${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''}`}</span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {expanded && (
            <ul className="px-5 pb-5 pt-4 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
              {result.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={clsx('shrink-0 mt-0.5', {
                    'badge-critical':   issue.severity === 'critical',
                    'badge-warning':    issue.severity === 'warning',
                    'badge-suggestion': issue.severity === 'suggestion' || !issue.severity,
                  })}>
                    {issue.severity === 'critical' ? 'Critical' : issue.severity === 'warning' ? 'Warning' : 'Note'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{issue.title}</p>
                    {issue.description && (
                      <p className="text-xs text-muted mt-0.5 leading-relaxed">{issue.description}</p>
                    )}
                    {issue.line_hint && (
                      <code className="text-xs text-muted/70 font-mono mt-1 block">{issue.line_hint}</code>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
