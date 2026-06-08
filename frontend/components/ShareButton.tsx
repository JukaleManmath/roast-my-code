'use client'

import { toast } from 'sonner'
import { Link2 } from 'lucide-react'

interface ShareButtonProps {
  slug: string
}

export function ShareButton({ slug }: ShareButtonProps) {
  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${slug}`)
    toast.success('Link copied to clipboard')
  }

  return (
    <button onClick={copy} className="btn-secondary text-sm flex items-center gap-2 py-2 px-4">
      <Link2 size={14} />
      Share
    </button>
  )
}
