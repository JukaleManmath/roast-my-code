'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Code2, Upload, Github, Loader2 } from 'lucide-react'
import { submitReview, submitFileReview, ApiError } from '@/lib/api'

type Tab = 'paste' | 'file' | 'github'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'paste',  label: 'Paste code',  icon: <Code2 size={14} /> },
  { id: 'file',   label: 'Upload file', icon: <Upload size={14} /> },
  { id: 'github', label: 'GitHub URL',  icon: <Github size={14} /> },
]

export function InputPanel() {
  const router = useRouter()
  const [tab, setTab]         = useState<Tab>('paste')
  const [code, setCode]       = useState('')
  const [ghUrl, setGhUrl]     = useState('')
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const fileRef               = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      let result: { id: string }
      if (tab === 'paste') {
        if (!code.trim()) { setError('Paste some code first.'); return }
        result = await submitReview({ input_mode: 'paste', code })
      } else if (tab === 'github') {
        if (!ghUrl.trim()) { setError('Enter a GitHub URL.'); return }
        result = await submitReview({ input_mode: 'github', github_url: ghUrl })
      } else {
        if (!file) { setError('Select a file first.'); return }
        result = await submitFileReview(file)
      }
      router.push(`/review/${result.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-black/[0.06] bg-subtle/40">
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
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your code here…"
            spellCheck={false}
            className="w-full h-64 bg-transparent resize-none font-mono text-sm text-ink placeholder:text-muted/50 focus:outline-none leading-relaxed"
          />
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
            className="py-10 flex flex-col items-center justify-center border-2 border-dashed border-black/[0.08] rounded-xl cursor-pointer hover:border-ink/20 transition-colors"
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
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}

        <div className="mt-5 flex justify-between items-center">
          <p className="text-xs text-muted">Free. No login required.</p>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex items-center gap-2 py-2.5"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting…
              </>
            ) : (
              'Roast my code'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
