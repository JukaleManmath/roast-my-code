'use client'

import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

interface Cmd {
  id: string
  label: string
  group: string
  icon: React.ReactNode
  action: () => void
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

  const close = useCallback(() => setOpen(false), [])

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const commands: Cmd[] = [
    {
      id: 'new-review',
      label: 'New review',
      group: 'Navigate',
      icon: <PlusIcon />,
      action: () => { router.push('/'); close() },
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      group: 'Navigate',
      icon: <GridIcon />,
      action: () => { router.push('/dashboard'); close() },
    },
    {
      id: 'toggle-theme',
      label: resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      group: 'Appearance',
      icon: resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />,
      action: () => { setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'); close() },
    },
  ]

  if (!open) return null

  return (
    <>
      <div className="cmdk-overlay" onClick={close} />
      <div className="cmdk-dialog">
        <Command>
          <div style={{ borderBottom: '1px solid var(--border)' }} className="flex items-center px-4 gap-3">
            <SearchIcon />
            <Command.Input
              autoFocus
              placeholder="Type a command or search..."
              className="w-full py-4 text-sm bg-transparent text-ink placeholder:text-muted outline-none"
            />
            <kbd className="text-[10px] text-muted border rounded px-1.5 py-0.5 shrink-0" style={{ borderColor: 'var(--border)' }}>
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-72 overflow-y-auto py-2">
            <Command.Empty className="py-10 text-center text-sm text-muted">
              No results found.
            </Command.Empty>

            {['Navigate', 'Appearance'].map((group) => {
              const items = commands.filter((c) => c.group === group)
              return (
                <Command.Group
                  key={group}
                  heading={group}
                  className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted"
                >
                  {items.map((cmd) => (
                    <Command.Item
                      key={cmd.id}
                      onSelect={cmd.action}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink cursor-pointer rounded-lg mx-2
                                 data-[selected=true]:bg-subtle outline-none transition-colors duration-100"
                    >
                      <span className="text-muted">{cmd.icon}</span>
                      {cmd.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )
            })}
          </Command.List>

          <div className="px-4 py-2.5 flex items-center gap-4" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-[11px] text-muted flex items-center gap-1">
              <kbd className="border rounded px-1 py-0.5 text-[10px]" style={{ borderColor: 'var(--border)' }}>↑↓</kbd> navigate
            </span>
            <span className="text-[11px] text-muted flex items-center gap-1">
              <kbd className="border rounded px-1 py-0.5 text-[10px]" style={{ borderColor: 'var(--border)' }}>↵</kbd> select
            </span>
          </div>
        </Command>
      </div>
    </>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )
}
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  )
}
