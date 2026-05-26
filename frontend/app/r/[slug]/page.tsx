import { Navbar } from '@/components/Navbar'
import { SynthesisPanel } from '@/components/SynthesisPanel'
import { AgentCard } from '@/components/AgentCard'
import { ShareButton } from '@/components/ShareButton'
import { getReviewBySlug } from '@/lib/api'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const AGENT_NAMES = ['pragmatist', 'paranoid', 'minimalist', 'optimizer', 'mentor'] as const

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props) {
  return {
    title: 'Code Review · RoastMyCode',
    description: 'Shared AI code review from RoastMyCode.',
  }
}

export default async function SharePage({ params }: Props) {
  let review

  try {
    review = await getReviewBySlug(params.slug)
  } catch {
    notFound()
  }

  if (!review.synthesis) {
    return (
      <>
        <Navbar />
        <main className="pt-16 min-h-dvh bg-canvas flex items-center justify-center">
          <p className="text-muted">This review is not yet complete.</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-dvh bg-canvas">
        <div className="container-xl py-12">

          {/* Header */}
          <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
            <div>
              <span className="eyebrow block mb-3">Public review</span>
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                {review.filename ?? review.language}
              </h1>
              <p className="text-sm text-muted mt-1">
                {review.language} &middot; {review.completed_at ? new Date(review.completed_at).toLocaleDateString() : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ShareButton slug={params.slug} />
              <Link href="/" className="btn-primary text-sm">
                Review my code
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <p className="eyebrow">Agent Reviews</p>
              {AGENT_NAMES.map((name) => (
                <AgentCard key={name} name={name} result={review.agent_results?.[name]} />
              ))}
            </div>
            <div>
              <p className="eyebrow mb-4">Final Verdict</p>
              <SynthesisPanel synthesis={review.synthesis} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
