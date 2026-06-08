'use client'

import { useEffect, useRef } from 'react'

interface FadeInProps {
  children: React.ReactNode
  className?: string
  delay?: 0 | 1 | 2 | 3 | 4 | 5
  as?: keyof JSX.IntrinsicElements
}

export function FadeIn({ children, className = '', delay = 0, as: Tag = 'div' }: FadeInProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const delayClass = delay > 0 ? `delay-${delay}` : ''

  return (
    // @ts-expect-error dynamic tag
    <Tag ref={ref} className={`fade-up ${delayClass} ${className}`}>
      {children}
    </Tag>
  )
}
