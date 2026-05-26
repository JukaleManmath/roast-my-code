'use client'

import { clsx } from 'clsx'
import type { Synthesis } from '@/lib/api'

interface SynthesisPanelProps {
  synthesis: Synthesis
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 70 ? '#dc2626' :
    score >= 40 ? '#d97706' :
    '#16a34a'

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-20 h-20 rounded-full border-[3px] flex items-center justify-center bg-subtle"
        style={{ borderColor: color }}
      >
        <span className="text-2xl font-bold text-ink">{score}</span>
      </div>
      <p className="text-xs text-muted mt-2 text-center">Roast Score</p>
      <p className="text-[11px] text-muted/60 text-center">0 = clean · 100 = rewrite</p>
    </div>
  )
}

function IssueList({ issues, type }: { issues: Synthesis['critical']; type: 'critical' | 'warning' | 'suggestion' }) {
  if (!issues?.length) return null

  const label = { critical: 'Critical', warning: 'Warning', suggestion: 'Suggestion' }[type]

  return (
    <div>
      <h3 className="eyebrow mb-3">{label}s</h3>
      <div className="space-y-2">
        {issues.map((issue, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start gap-3">
              <span className={clsx('shrink-0 mt-0.5', `badge-${type}`)}>
                {label}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{issue.title}</p>
                <p className="text-sm text-muted mt-1 leading-relaxed">{issue.description}</p>
                {issue.agents && issue.agents.length > 0 && (
                  <p className="text-xs text-muted/60 mt-2">Flagged by {issue.agents.join(', ')}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SynthesisPanel({ synthesis }: SynthesisPanelProps) {
  return (
    <div className="space-y-8 animate-slide-up">
      {/* Score + summary */}
      <div className="card p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreRing score={synthesis.overall_score} />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-ink mb-2">Verdict</h2>
          <p className="text-sm text-muted leading-relaxed">{synthesis.summary}</p>
        </div>
      </div>

      <IssueList issues={synthesis.critical}    type="critical" />
      <IssueList issues={synthesis.warnings}    type="warning" />
      <IssueList issues={synthesis.suggestions} type="suggestion" />

      {(synthesis.conflicts?.length ?? 0) > 0 && (
        <div>
          <h3 className="eyebrow mb-3">Agent Conflicts</h3>
          <div className="space-y-2">
            {synthesis.conflicts.map((conflict, i) => (
              <div key={i} className="card p-4">
                <p className="text-sm font-semibold text-ink mb-3">{conflict.topic}</p>
                <div className="space-y-2">
                  {Object.entries(conflict.positions).map(([agent, position]) => (
                    <div key={agent} className="flex gap-2 text-sm">
                      <span className="text-ink font-medium capitalize shrink-0">{agent}:</span>
                      <span className="text-muted">{position}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
