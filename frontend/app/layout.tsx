import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RoastMyCode - AI Code Review',
  description: 'Five AI engineers review your code and tell you exactly what\'s wrong with it.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
