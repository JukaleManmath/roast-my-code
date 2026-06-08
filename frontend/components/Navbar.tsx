'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { AuthButton } from './AuthButton'
import { LogoMark } from './LogoMark'

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return <div className="w-9 h-9" />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      style={{ border: '1px solid var(--border)' }}
      className="w-9 h-9 rounded-lg flex items-center justify-center bg-subtle text-muted hover:text-ink transition-all duration-150 hover:scale-105 active:scale-95"
    >
      {isDark ? (
        /* Sun */
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        /* Moon */
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
      )}
    </button>
  )
}

export function Navbar() {
  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-16 backdrop-blur-md"
      style={{
        backgroundColor: 'rgb(var(--canvas-rgb) / 0.85)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container-xl h-full flex items-center justify-between">

        <Link href="/" className="flex items-center gap-3 group">
          <LogoMark size={34} />
          <span className="leading-none flex items-baseline gap-1">
            <span className="text-[17px] font-black tracking-tight text-ink uppercase">ROAST</span>
            <span className="text-[13px] font-medium text-muted font-mono uppercase tracking-wider">MY</span>
            <span className="text-[15px] font-bold font-mono text-ink tracking-tight">CODE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mb-0.5 shrink-0" />
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/" className="btn-ghost text-sm">
            New review
          </Link>
          <Link href="/dashboard" className="btn-ghost text-sm">
            Dashboard
          </Link>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
            className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg text-xs text-muted transition-colors duration-150 hover:text-ink"
            style={{ border: '1px solid var(--border)', backgroundColor: 'rgb(var(--subtle-rgb))' }}
            aria-label="Open command palette"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span>Search</span>
            <kbd className="text-[10px] opacity-60">⌘K</kbd>
          </button>
          <ThemeToggle />
          <div className="w-px h-5 mx-2" style={{ backgroundColor: 'var(--border)' }} />
          <AuthButton />
        </nav>

      </div>
    </header>
  )
}
