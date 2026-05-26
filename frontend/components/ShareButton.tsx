'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

interface ShareButtonProps {
  slug: string
}

export function ShareButton({ slug }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={copy} className="btn-secondary text-sm flex items-center gap-2 py-2 px-4">
      {copied ? <><Check size={14} /> Copied</> : <><Link2 size={14} /> Share</>}
    </button>
  )
}
