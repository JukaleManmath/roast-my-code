'use client'

import Link from 'next/link'
import { AuthButton } from './AuthButton'
import { LogoMark } from './LogoMark'
import { useAuth } from '@/lib/auth'

export function Navbar() {
  const { user } = useAuth()

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-16"
      style={{
        backgroundColor: 'rgb(var(--canvas-rgb))',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container-xl h-full flex items-center justify-between">

        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <span className="leading-none flex items-baseline gap-0.5">
            <span className="text-[16px] font-black tracking-tight text-ink uppercase">Panel</span>
            <span className="text-[16px] font-black tracking-tight text-ink uppercase">Review</span>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mb-0.5 shrink-0" />
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/" className="btn-ghost text-sm">
            New review
          </Link>
          {user && (
            <Link href="/dashboard" className="btn-ghost text-sm">
              Dashboard
            </Link>
          )}
          <div className="w-px h-5 mx-2" style={{ backgroundColor: 'var(--border)' }} />
          <AuthButton />
        </nav>

      </div>
    </header>
  )
}
