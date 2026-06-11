import type { Metadata, Viewport } from 'next'
import AppChrome from '@/components/AppChrome'
import { LanguageProvider } from '@/components/LanguageProvider'
import { bangla, body, display, mono } from '@/lib/fonts'
import './globals.css'

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
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${display.variable} ${body.variable} ${bangla.variable} ${mono.variable}`}>
      <body className="bg-cream text-ink antialiased">
        <LanguageProvider>
          {children}
          <AppChrome />
        </LanguageProvider>
      </body>
    </html>
  )
}
