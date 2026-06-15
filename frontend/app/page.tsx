'use client'

import { Navbar } from '@/components/Navbar'
import { InputPanel } from '@/components/InputPanel'
import { LogoMark } from '@/components/LogoMark'
import { useAuth, buildGoogleOAuthUrl } from '@/lib/auth'
import Link from 'next/link'

const AGENTS = [
  {
    name: 'Pragmatist',
    role: 'Staff Backend Engineer',
    tagline: 'Will this actually work in production?',
    description: 'Reviews your code the way a senior engineer would in a production PR. Error handling, edge cases, and real-world maintainability.',
  },
  {
    name: 'Paranoid',
    role: 'Penetration Tester',
    tagline: 'How does an attacker break this?',
    description: 'Hunts for security vulnerabilities: injection flaws, insecure defaults, exposed secrets, and attack surface you did not know you had.',
  },
  {
    name: 'Minimalist',
    role: 'Clean Code Evangelist',
    tagline: 'Is this more complex than it needs to be?',
    description: 'Flags unnecessary complexity, SOLID violations, and anything that will confuse the next person reading this in six months.',
  },
  {
    name: 'Optimizer',
    role: 'Performance Engineer',
    tagline: 'Where does this fall apart under load?',
    description: 'Identifies algorithmic bottlenecks, N+1 queries, and memory waste. Anything that will not scale past a certain load.',
  },
  {
    name: 'Mentor',
    role: 'Senior Onboarding Engineer',
    tagline: 'Could someone new to this codebase understand it?',
    description: 'Reads your code from the perspective of someone new to the codebase. Tells you what is confusing, undocumented, or risky to touch.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Submit your code',
    body: 'Paste a snippet, upload a file, or drop a GitHub link. Any language works.',
  },
  {
    step: '02',
    title: 'Five experts review independently',
    body: 'Each AI engineer runs with a different lens. No consensus bias. They never see each other\'s results.',
  },
  {
    step: '03',
    title: 'See where they disagree',
    body: 'Conflicts between agents are surfaced explicitly. You see both stances side by side and decide who is right.',
  },
]

export default function HomePage() {
  const { user } = useAuth()

  return (
    <>
      <Navbar />

      <main className="pt-16">

        {/* Hero */}
        <section className="section flex flex-col items-center text-center px-4">
          <p className="text-sm font-medium text-muted mb-6">AI code review</p>

          <h1 className="text-[52px] sm:text-[68px] font-bold leading-[1.05] tracking-[-0.03em] text-ink max-w-3xl">
            Five experts.<br className="hidden sm:block" /> One structured debate.
          </h1>

          <p className="text-lg sm:text-xl text-muted mt-6 max-w-xl leading-relaxed font-light">
            A security expert, a performance engineer, a clean-code purist, a mentor, and a staff
            engineer independently review your code. The panel then surfaces exactly where they disagree.
          </p>

          <div className="mt-10">
            <a href="#submit" className="btn-primary text-base px-8 py-3.5">
              Start your review
            </a>
          </div>

          <div className="w-full max-w-2xl mt-20" id="submit">
            <InputPanel />
          </div>
        </section>

        {/* Intro 3-col */}
        <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: 'Not another linter.',
                body: 'Linters catch syntax. Static analysis catches patterns. This catches the things that get you in code review: design decisions, security gaps, and performance time bombs.',
              },
              {
                title: 'Experts disagree by design.',
                body: 'When the Paranoid agent flags a critical risk and the Pragmatist calls it an acceptable tradeoff, you see both stances side by side. Every competitor gives you one verdict. This gives you the debate.',
              },
              {
                title: 'Works on anything.',
                body: 'Paste a function, upload a module, or link a GitHub file. Python, TypeScript, Go, Rust, SQL. If it is code the panel will read it.',
              },
            ].map((item) => (
              <div key={item.title}>
                <p className="text-2xl font-semibold text-ink leading-snug mb-3">{item.title}</p>
                <p className="text-muted leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="section bg-subtle/40" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <p className="text-sm font-medium text-muted mb-4 text-center">How it works</p>
            <h2 className="text-4xl font-bold tracking-tight text-ink text-center mb-16">
              From paste to panel in seconds.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="card p-8 h-full">
                  <p className="text-4xl font-bold text-ink/10 mb-4">{item.step}</p>
                  <p className="text-base font-semibold text-ink mb-2">{item.title}</p>
                  <p className="text-sm text-muted leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Panel */}
        <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <p className="text-sm font-medium text-muted mb-4">The panel</p>
            <h2 className="text-4xl font-bold tracking-tight text-ink mb-4 max-w-xl">
              Meet the panel.
            </h2>
            <p className="text-muted max-w-lg mb-16 leading-relaxed">
              Each reviewer has a fixed persona and a different priority. Conflicts between them
              are the point. They surface real tradeoffs in your code.
            </p>

            <div className="space-y-4">
              {AGENTS.map((agent) => (
                <div key={agent.name} className="card-hover p-6 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-subtle flex items-center justify-center">
                    <span className="text-xs font-semibold text-muted">{agent.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-ink">{agent.name}</p>
                      <span className="text-xs text-muted rounded-full px-2.5 py-0.5" style={{ border: '1px solid var(--border)' }}>{agent.role}</span>
                    </div>
                    <p className="text-xs text-muted italic mb-1.5">{agent.tagline}</p>
                    <p className="text-sm text-muted leading-relaxed">{agent.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free vs Account — hidden for logged-in users */}
        {!user && <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <p className="text-sm font-medium text-muted mb-4 text-center">What you get</p>
            <h2 className="text-4xl font-bold tracking-tight text-ink text-center mb-4">
              Free for everyone. More for members.
            </h2>
            <p className="text-muted text-center max-w-lg mx-auto mb-16 leading-relaxed">
              No account needed to get your code reviewed. Sign in to unlock history and shareable reports.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

              <div className="card p-8 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-lg bg-subtle flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-muted"/>
                      <path d="M4 8.5L6.5 11L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">No account</p>
                    <p className="text-xs text-muted">Start immediately</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {[
                    'Full five-agent code review',
                    'Live streaming results',
                    'Conflict detection: see where experts disagree',
                    'Critical, warning and suggestion ranking',
                    'Any language, any input method',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted">
                      <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path d="M3 7.5L6 10.5L12 4.5" stroke="#22C55E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card p-8 h-full relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-0.5 bg-ink rounded-t-2xl" />

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-lg bg-ink flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="5" r="3" stroke="white" strokeWidth="1.5"/>
                      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Signed in</p>
                    <p className="text-xs text-muted">Free account</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {[
                    { text: 'Everything in the free tier', always: true },
                    { text: 'Full review history and dashboard', always: false },
                    { text: 'Save and revisit any past review', always: false },
                    { text: 'Shareable public links for any review', always: false },
                    { text: 'Reviews linked to your account', always: false },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-3 text-sm">
                      <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path d="M3 7.5L6 10.5L12 4.5" stroke="#22C55E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className={item.always ? 'text-muted' : 'text-ink font-medium'}>{item.text}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={buildGoogleOAuthUrl()}
                  className="btn-primary w-full mt-8 text-sm text-center block"
                >
                  Create free account
                </a>
              </div>

            </div>
          </div>
        </section>}

        {/* Final CTA — hidden for logged-in users */}
        {!user &&
        <section className="section text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <h2 className="text-5xl font-bold tracking-tight text-ink mb-6">
              See what five experts think.
            </h2>
            <p className="text-muted text-lg mb-10 max-w-md mx-auto leading-relaxed">
              Free to use. No account required. Results in under 30 seconds.
            </p>
            <a href="#submit" className="btn-primary text-base px-10 py-4 inline-flex">
              Start your review
            </a>
          </div>
        </section>}

        {/* Footer */}
        <footer className="py-10" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl flex flex-col sm:flex-row items-center justify-between gap-6">

            <div className="flex items-center gap-2.5">
              <LogoMark size={32} />
              <span className="leading-none flex items-baseline gap-0.5">
                <span className="text-[15px] font-black tracking-tight text-ink uppercase">Panel</span>
                <span className="text-[15px] font-black tracking-tight text-ink uppercase">Review</span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mb-0.5 shrink-0" />
              </span>
            </div>

            <p className="text-xs text-muted">Five perspectives on every review.</p>

            <p className="text-xs text-muted">Built as a portfolio project.</p>

          </div>
        </footer>
      </main>
    </>
  )
}
