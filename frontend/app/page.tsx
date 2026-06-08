import { Navbar } from '@/components/Navbar'
import { InputPanel } from '@/components/InputPanel'
import { FadeIn } from '@/components/FadeIn'
import Link from 'next/link'

const AGENTS = [
  {
    name: 'Pragmatist',
    role: 'Staff Backend Engineer',
    description: 'Reviews your code the way a senior engineer would in a production PR. Error handling, edge cases, and real-world maintainability.',
  },
  {
    name: 'Paranoid',
    role: 'Penetration Tester',
    description: 'Hunts for security vulnerabilities: injection flaws, insecure defaults, exposed secrets, and attack surface you did not know you had.',
  },
  {
    name: 'Minimalist',
    role: 'Clean Code Evangelist',
    description: 'Flags unnecessary complexity, SOLID violations, and anything that will confuse the next person reading this in six months.',
  },
  {
    name: 'Optimizer',
    role: 'Performance Engineer',
    description: 'Identifies algorithmic bottlenecks, N+1 queries, and memory waste. Anything that will not scale past a certain load.',
  },
  {
    name: 'Mentor',
    role: 'Senior Onboarding Engineer',
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
    title: 'Five agents review in parallel',
    body: 'Each AI engineer runs independently with a different lens. No consensus bias.',
  },
  {
    step: '03',
    title: 'Get a ranked verdict',
    body: 'Critical issues, warnings, and suggestions. A 0 to 100 roast score and a shareable report.',
  },
]

export default function HomePage() {
  return (
    <>
      <Navbar />

      <main className="pt-16">

        {/* Hero */}
        <section className="section relative flex flex-col items-center text-center px-4 overflow-hidden">
          {/* Background orbs */}
          <div className="hero-orb hero-orb-orange" />
          <div className="hero-orb hero-orb-indigo" />

          <FadeIn>
            <p className="eyebrow mb-6">AI code review</p>
          </FadeIn>

          <FadeIn delay={1}>
            <h1 className="text-[52px] sm:text-[68px] font-bold leading-[1.05] tracking-[-0.03em] text-ink max-w-3xl">
              Five engineers.<br className="hidden sm:block" /> One roast. 🔥
            </h1>
          </FadeIn>

          <FadeIn delay={2}>
            <p className="text-lg sm:text-xl text-muted mt-6 max-w-xl leading-relaxed font-light">
              A security expert, a performance engineer, a clean-code purist, a mentor, and a staff
              engineer all reading your code at once and telling you exactly what is wrong.
            </p>
          </FadeIn>

          <FadeIn delay={3}>
            <div className="flex items-center gap-3 mt-10">
              <a href="#submit" className="btn-primary text-base px-8 py-3.5">
                Roast my code
              </a>
              <Link href="/example" className="btn-secondary text-base px-8 py-3.5">
                See an example
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={4} className="w-full max-w-2xl mt-20">
            <div id="submit">
              <InputPanel />
            </div>
          </FadeIn>
        </section>

        {/* Intro 3-col */}
        <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: 'Not another linter.',
                body: 'Linters catch syntax. Static analysis catches patterns. This catches the things that get you in code review: the design decisions, the security gaps, the performance time bombs.',
              },
              {
                title: 'No consensus bias.',
                body: 'Each agent runs independently before seeing the others. You get genuine disagreements surfaced openly, not a smoothed-over average opinion.',
              },
              {
                title: 'Works on anything.',
                body: 'Paste a function, upload a module, or link a GitHub file. Python, TypeScript, Go, Rust, SQL. If it is code the panel will read it.',
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={(i + 1) as 1 | 2 | 3}>
                <p className="text-2xl font-semibold text-ink leading-snug mb-3">{item.title}</p>
                <p className="text-muted leading-relaxed">{item.body}</p>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="section bg-subtle/40" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <FadeIn>
              <p className="eyebrow mb-4 text-center">How it works</p>
              <h2 className="text-4xl font-bold tracking-tight text-ink text-center mb-16">
                From paste to verdict in seconds.
              </h2>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((item, i) => (
                <FadeIn key={item.step} delay={(i + 1) as 1 | 2 | 3}>
                  <div className="card p-8 h-full">
                    <p className="text-4xl font-bold text-ink/10 mb-4">{item.step}</p>
                    <p className="text-base font-semibold text-ink mb-2">{item.title}</p>
                    <p className="text-sm text-muted leading-relaxed">{item.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* The Panel */}
        <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <FadeIn>
              <p className="eyebrow mb-4">Your review panel</p>
              <h2 className="text-4xl font-bold tracking-tight text-ink mb-4 max-w-xl">
                Five perspectives. One verdict.
              </h2>
              <p className="text-muted max-w-lg mb-16 leading-relaxed">
                Each engineer has a fixed persona and a different priority. Conflict between them
                is a feature. It surfaces real tradeoffs in your code.
              </p>
            </FadeIn>

            <div className="space-y-4">
              {AGENTS.map((agent, i) => (
                <FadeIn key={agent.name} delay={Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}>
                  <div className="card-hover p-6 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-subtle flex items-center justify-center">
                      <span className="text-xs font-semibold text-muted">{agent.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-ink">{agent.name}</p>
                        <span className="text-xs text-muted rounded-full px-2.5 py-0.5" style={{ border: '1px solid var(--border)' }}>{agent.role}</span>
                      </div>
                      <p className="text-sm text-muted leading-relaxed">{agent.description}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Free vs Account */}
        <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <FadeIn>
              <p className="eyebrow mb-4 text-center">What you get</p>
              <h2 className="text-4xl font-bold tracking-tight text-ink text-center mb-4">
                Free for everyone. More for members.
              </h2>
              <p className="text-muted text-center max-w-lg mx-auto mb-16 leading-relaxed">
                No account needed to get your code roasted. Sign in to unlock history, exports, and shareable reports.
              </p>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

              <FadeIn delay={1}>
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
                      'Critical, warning and suggestion ranking',
                      '0 to 100 roast score',
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
              </FadeIn>

              <FadeIn delay={2}>
                <div className="card p-8 h-full relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-ink rounded-t-2xl" />

                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-lg bg-ink flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" className="text-canvas"/>
                        <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-canvas"/>
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
                      { text: 'Export reports as PDF', always: false },
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
                    href={`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
                      client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
                      redirect_uri:  'http://localhost:3000/auth/callback',
                      response_type: 'code',
                      scope:         'openid email profile',
                      access_type:   'offline',
                      prompt:        'select_account',
                    }).toString()}`}
                    className="btn-primary w-full mt-8 text-sm text-center block"
                  >
                    Create free account
                  </a>
                </div>
              </FadeIn>

            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="section text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl">
            <FadeIn>
              <h2 className="text-5xl font-bold tracking-tight text-ink mb-6">
                Ready to get roasted?
              </h2>
              <p className="text-muted text-lg mb-10 max-w-md mx-auto leading-relaxed">
                Free to use. No account required. Results in under 30 seconds.
              </p>
              <a href="#submit" className="btn-primary text-base px-10 py-4 inline-flex">
                Submit your code
              </a>
            </FadeIn>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-xl flex flex-col sm:flex-row items-center justify-between gap-6">

            <div className="flex items-center gap-3">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="10" fill="rgb(var(--ink-rgb))"/>
                <line x1="12" y1="28" x2="18" y2="12" stroke="rgb(var(--canvas-rgb))" strokeWidth="3.5" strokeLinecap="round"/>
                <line x1="20" y1="28" x2="26" y2="12" stroke="rgb(var(--canvas-rgb))" strokeWidth="3.5" strokeLinecap="round"/>
                <circle cx="31" cy="12" r="3.5" fill="#F97316"/>
              </svg>
              <div className="flex items-baseline gap-1">
                <span className="text-[15px] font-black tracking-tight text-ink uppercase">ROAST</span>
                <span className="text-[12px] font-medium text-muted font-mono uppercase tracking-wider">MY</span>
                <span className="text-[14px] font-bold font-mono text-ink tracking-tight">CODE</span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mb-0.5 shrink-0" />
              </div>
            </div>

            <p className="text-xs text-muted font-mono tracking-widest">
              // no code is safe
            </p>

            <p className="text-xs text-muted">Built as a portfolio project.</p>

          </div>
        </footer>
      </main>
    </>
  )
}
