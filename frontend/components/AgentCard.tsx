'use client'

import { clsx } from 'clsx'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { AgentResult } from '@/lib/api'

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
}

export function AgentCard({ name, result, loading }: AgentCardProps) {
  const meta = AGENT_META[name] ?? { label: name, description: '' }
  const done = !!result

  return (
    <div className={clsx('card p-5 transition-all duration-300', done ? 'animate-slide-up' : 'opacity-50')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-ink">{meta.label}</p>
          <p className="text-xs text-muted mt-0.5">{meta.description}</p>
        </div>
        {loading && !done && <Loader2 size={15} className="text-muted animate-spin shrink-0 mt-0.5" />}
        {done    && <CheckCircle2 size={15} className="text-ink/40 shrink-0 mt-0.5" />}
      </div>

      {/* Skeleton */}
      {!done && (
        <div className="space-y-2">
          <div className="h-3 shimmer w-4/5" />
          <div className="h-3 shimmer w-3/5" />
          <div className="h-3 shimmer w-2/3" />
        </div>
      )}

      {/* Summary */}
      {done && result?.summary && (
        <p className="text-sm text-muted leading-relaxed mb-4">{result.summary}</p>
      )}

      {/* Issues */}
      {done && result?.issues && result.issues.length > 0 && (
        <ul className="space-y-3">
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

      {done && (!result?.issues || result.issues.length === 0) && (
        <p className="text-sm text-muted italic">No issues found.</p>
      )}
    </div>
  )
}
