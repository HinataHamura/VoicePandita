import type { Metadata, Viewport } from 'next'
import { DM_Sans, JetBrains_Mono, Noto_Sans_Bengali, Playfair_Display } from 'next/font/google'
import AppChrome from '@/components/AppChrome'
import './globals.css'

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const bangla = Noto_Sans_Bengali({
  subsets: ['bengali'],
  variable: '--font-bangla',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'VoicePandita - Learn. Understand. Belong.',
  description: 'Bangladesh voice-first AI tutor for Bangla, Chakma, Marma, Garo and accessible student learning.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.jpg' },
  openGraph: {
    title: 'VoicePandita',
    description: 'Voice-first AI tutoring for every Bangladeshi student',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#2A5C45',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${display.variable} ${body.variable} ${bangla.variable} ${mono.variable}`}>
      <body className="bg-cream text-ink antialiased">
        {children}
        <AppChrome />
      </body>
    </html>
  )
}
