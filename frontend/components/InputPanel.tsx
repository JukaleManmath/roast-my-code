'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Code2, Upload, Github, Loader2 } from 'lucide-react'
import { submitReview, submitFileReview, ApiError } from '@/lib/api'
import { useAuth, buildGoogleOAuthUrl } from '@/lib/auth'

type Tab = 'paste' | 'file' | 'github'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'paste',  label: 'Paste code',  icon: <Code2 size={14} /> },
  { id: 'file',   label: 'Upload file', icon: <Upload size={14} /> },
  { id: 'github', label: 'GitHub URL',  icon: <Github size={14} /> },
]

const LANGUAGES = [
  'Bash', 'C', 'C++', 'C#', 'CSS', 'Dart', 'Go', 'HTML', 'Java',
  'JavaScript', 'Kotlin', 'Lua', 'Mojo', 'PHP', 'Python', 'R',
  'Ruby', 'Rust', 'Scala', 'Shell', 'SQL', 'Swift', 'TypeScript',
]

const DETECT_RULES: [RegExp, string][] = [
  [/\bdef \w+\s*\(|from \w+ import\b|import \w+\n|\bprint\s*\(/, 'Python'],
  [/:\s*(string|number|boolean|void|any)\b|interface \w+\s*\{|<[A-Z]\w*>/, 'TypeScript'],
  [/\bconst\b|\blet\b|\bvar\b|\b=>\b|\bconsole\.log\b/, 'JavaScript'],
  [/\bfunc \w+\s*\(|\bpackage \w+|\bgo func\b|:=/, 'Go'],
  [/\bfn \w+|let mut |use std::|impl \w+/, 'Rust'],
  [/\bpublic class\b|\bSystem\.out\b|\bvoid main\b/, 'Java'],
  [/SELECT\b.+FROM\b|INSERT INTO\b|CREATE TABLE\b/i, 'SQL'],
  [/#include\s*<\w+\.h>|\bprintf\s*\(|\bint main\s*\(/, 'C'],
  [/\becho\b|\$\w+|\bfi\b|\bthen\b/, 'Bash'],
  [/\bfn main\(\)|use std::|extern crate/, 'Rust'],
]

function detectLanguage(code: string): string | null {
  for (const [re, lang] of DETECT_RULES) {
    if (re.test(code)) return lang
  }
  return null
}

export function InputPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab]           = useState<Tab>('paste')
  const [code, setCode]         = useState('')
  const [ghUrl, setGhUrl]       = useState('')
  const [file, setFile]         = useState<File | null>(null)
  const [language, setLanguage] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const fileRef                 = useRef<HTMLInputElement>(null)

  function handleCodeChange(value: string) {
    setCode(value)
    if (!language && value.length > 40) {
      const detected = detectLanguage(value)
      if (detected) setLanguage(detected)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!language) { setError('Select a language before submitting.'); return }
    setLoading(true)
    try {
      let result: { id: string }
      if (tab === 'paste') {
        if (!code.trim()) { setError('Paste some code first.'); return }
        result = await submitReview({ input_mode: 'paste', code, language })
      } else if (tab === 'github') {
        if (!ghUrl.trim()) { setError('Enter a GitHub URL.'); return }
        result = await submitReview({ input_mode: 'github', github_url: ghUrl, language })
      } else {
        if (!file) { setError('Select a file first.'); return }
        result = await submitFileReview(file, language)
      }
      router.push(`/review/${result.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const lineCount = code ? code.split('\n').length : 0
  const charCount = code.length

  return (
    <div className="card overflow-hidden">
      {/* Tab bar */}
      <div className="flex bg-subtle/40" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px',
              tab === t.id
                ? 'text-ink border-ink'
                : 'text-muted border-transparent hover:text-ink',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'paste' && (
          <div className="relative">
            <textarea
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Paste your code here…"
              spellCheck={false}
              className="w-full h-64 bg-transparent resize-none font-mono text-sm text-ink placeholder:text-muted/50 focus:outline-none leading-relaxed"
            />
            {charCount > 0 && (
              <p className="text-[11px] text-muted/50 font-mono mt-1 text-right">
                {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {charCount.toLocaleString()} chars
              </p>
            )}
          </div>
        )}

        {tab === 'github' && (
          <div className="py-6">
            <input
              type="url"
              value={ghUrl}
              onChange={(e) => setGhUrl(e.target.value)}
              placeholder="https://github.com/user/repo/blob/main/file.py"
              className="input"
            />
            <p className="text-xs text-muted mt-2">
              Link to a single file or a repository. We fetch up to 500 lines.
            </p>
          </div>
        )}

        {tab === 'file' && (
          <div
            className="py-10 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-colors"
            style={{
              border: '2px dashed var(--border)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgb(var(--ink-rgb) / 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const dropped = e.dataTransfer.files[0]
              if (dropped) setFile(dropped)
            }}
          >
            <Upload size={22} className="text-muted mb-3" />
            {file ? (
              <p className="text-sm text-ink font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-muted">Drop a file or click to browse</p>
                <p className="text-xs text-muted/60 mt-1">Any language, max 1 MB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 mt-3 flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!authLoading && (
              user
                ? <p className="text-xs text-muted shrink-0">Up to 500 lines per review</p>
                : <p className="text-xs text-muted shrink-0">Free · 200 line limit · <a href={buildGoogleOAuthUrl()} className="underline underline-offset-2">Sign in</a> for 500</p>
            )}
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={clsx(
                  'text-xs rounded-lg px-2 py-1.5 focus:outline-none cursor-pointer transition-colors',
                  language
                    ? 'text-ink'
                    : 'text-muted',
                )}
                style={{
                  background: 'rgb(var(--subtle-rgb))',
                  border: `1px solid ${language ? 'var(--border)' : 'rgb(239 68 68 / 0.5)'}`,
                }}
              >
                <option value="" disabled>Select language</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {language && tab === 'paste' && detectLanguage(code) === language && (
                <span className="absolute -top-2 -right-1 text-[9px] bg-green-500 text-white rounded-full px-1 leading-4">auto</span>
              )}
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex items-center gap-2 py-2.5 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting…
              </>
            ) : (
              'Start review'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
