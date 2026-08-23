import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif } from 'next/font/google'

import { cv } from '@/lib/data/cv'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

const fullName = `${cv.firstName} ${cv.lastName}`

export const metadata: Metadata = {
  title: `${fullName} — ${cv.title}`,
  description: cv.profile,
  openGraph: {
    title: `${fullName} — ${cv.title}`,
    description: cv.tagline,
    type: 'profile',
    locale: 'fr_FR',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1917' },
  ],
}

const themeScript = `(() => {
  try {
    const stored = localStorage.getItem('theme')
    const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    if (dark) document.documentElement.classList.add('dark')
  } catch {}
})()`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${instrument.variable} paper-grain antialiased`}>
        {children}
      </body>
    </html>
  )
}
