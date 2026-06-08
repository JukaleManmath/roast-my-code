'use client'

import { toast } from 'sonner'
import { FileDown } from 'lucide-react'
import { getPdfUrl } from '@/lib/api'

export function DownloadPDF({ reviewId }: { reviewId: string }) {
  function handleClick() {
    window.open(getPdfUrl(reviewId), '_blank')
    toast.success('PDF opened in new tab')
  }

  return (
    <button
      onClick={handleClick}
      className="btn-secondary text-sm flex items-center gap-2 py-2 px-4"
    >
      <FileDown size={14} />
      Export PDF
    </button>
  )
}
