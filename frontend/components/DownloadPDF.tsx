'use client'

import { FileDown } from 'lucide-react'
import { getPdfUrl } from '@/lib/api'

export function DownloadPDF({ reviewId }: { reviewId: string }) {
  return (
    <button
      onClick={() => window.open(getPdfUrl(reviewId), '_blank')}
      className="btn-secondary text-sm flex items-center gap-2 py-2 px-4"
    >
      <FileDown size={14} />
      Export PDF
    </button>
  )
}
