'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

type Settings = {
  dark?: boolean
}

function readSettings(): Settings {
  try {
    const saved = localStorage.getItem('vp_settings')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

export default function AppChrome() {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const applyTheme = () => {
      const settings = readSettings()
      document.documentElement.classList.toggle('vp-dark', Boolean(settings.dark))
    }

    applyTheme()
    window.addEventListener('storage', applyTheme)
    window.addEventListener('vp-settings-change', applyTheme)

    return () => {
      window.removeEventListener('storage', applyTheme)
      window.removeEventListener('vp-settings-change', applyTheme)
    }
  }, [])

  if (pathname?.startsWith('/learn')) return null

  return (
    <>
      <button
        onClick={() => setSidebarOpen(true)}
        className={`fixed left-4 top-4 z-[80] h-12 w-14 flex-col items-center justify-center rounded-lg border border-forest/10 bg-white/90 text-ink shadow-lg shadow-ink/10 backdrop-blur-xl hover:border-saffron/35 hover:bg-paper/80 ${sidebarOpen ? 'hidden' : 'flex'}`}
        aria-label="Open menu"
        title="Open menu"
      >
        <span className="mb-1 block h-0.5 w-6 rounded bg-current" />
        <span className="block h-0.5 w-4 rounded bg-current opacity-55" />
      </button>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
