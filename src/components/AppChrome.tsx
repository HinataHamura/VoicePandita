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
        className={`vp-menu-button fixed left-4 top-4 z-[80] flex h-12 w-12 flex-col items-center justify-center gap-1.5 rounded-md ${sidebarOpen ? 'hidden' : 'flex'}`}
        aria-label="Open menu"
        title="Open menu"
      >
        <span className="h-0.5 w-6 rounded-full bg-current" aria-hidden="true" />
        <span className="h-0.5 w-6 rounded-full bg-current" aria-hidden="true" />
        <span className="h-0.5 w-6 rounded-full bg-current" aria-hidden="true" />
      </button>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
