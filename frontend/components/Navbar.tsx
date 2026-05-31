'use client'

import Link from 'next/link'
import { AuthButton } from './AuthButton'
import { LogoMark } from './LogoMark'

export function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-black/[0.06] bg-canvas/80 backdrop-blur-md">
      <div className="container-xl h-full flex items-center justify-between">

        <Link href="/" className="flex items-center gap-3 group">
          <LogoMark size={34} />
          <span className="leading-none flex items-baseline gap-1">
            <span className="text-[17px] font-black tracking-tight text-ink uppercase">ROAST</span>
            <span className="text-[13px] font-medium text-ink/50 font-mono uppercase tracking-wider">MY</span>
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
          <AuthButton />
        </nav>

      </div>
    </header>
  )
}
