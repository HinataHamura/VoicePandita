'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Globe, Moon, Sun, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

interface Settings {
  lang: string
  offline: boolean
  sound: boolean
  dark: boolean
}

const defaultSettings: Settings = {
  lang: 'bn',
  offline: false,
  sound: true,
  dark: false,
}

function loadSettings(): Settings {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const saved = localStorage.getItem('vp_settings')
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation()
        onToggle()
      }}
      className={`group relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full p-1 shadow-inner transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-saffron/40 focus:ring-offset-2 focus:ring-offset-cream ${
        on ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-slate-700 shadow-slate-900/15'
      }`}
      aria-pressed={on}
      aria-label={on ? 'Turn off setting' : 'Turn on setting'}
    >
      <motion.span
        animate={{ x: on ? 24 : 0, rotate: on ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className="relative block h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
      />
    </button>
  )
}

function Row({ icon: Icon, label, sub, children, onClick }: { icon: any; label: string; sub?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      onKeyDown={event => {
        if (!onClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`flex items-center justify-between gap-4 py-4 border-b border-black/5 last:border-0 ${onClick ? 'cursor-pointer rounded-lg px-2 hover:bg-black/5' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-black/5 rounded-xl flex items-center justify-center">
          <Icon size={16} className="text-ink/50" />
        </div>
        <div>
          <div className="font-medium text-sm">{label}</div>
          {sub && <div className="text-xs text-ink/45 mt-0.5">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    localStorage.setItem('vp_settings', JSON.stringify(settings))
    document.documentElement.classList.toggle('vp-dark', settings.dark)
    window.dispatchEvent(new Event('vp-settings-change'))
  }, [settings])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-dvh bg-cream">
      <PageHeader title="Settings" subtitle="Local app preferences" backHref="/learn" backLabel="Back to learn" />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <h2 className="text-xs font-semibold text-ink/45 uppercase tracking-wider mb-2">Language and display</h2>
          <Row icon={Globe} label="Language" sub="Used by the tutor screen">
            <select value={settings.lang} onChange={event => update('lang', event.target.value)} className="text-sm border border-black/10 rounded-lg px-3 py-1.5 bg-cream focus:outline-none">
              <option value="bn">Bangla</option>
              <option value="ckm">Chakma</option>
              <option value="mrm">Marma</option>
              <option value="gnk">Garo</option>
              <option value="en">English</option>
            </select>
          </Row>
          <Row icon={settings.dark ? Moon : Sun} label="Dark mode" sub="High contrast reading preference" onClick={() => update('dark', !settings.dark)}>
            <Toggle on={settings.dark} onToggle={() => update('dark', !settings.dark)} />
          </Row>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
          <h2 className="text-xs font-semibold text-ink/45 uppercase tracking-wider mb-2">Connection and sound</h2>
          <Row icon={settings.offline ? WifiOff : Wifi} label="Prefer offline pack" sub="Use cached answers first on weak networks" onClick={() => update('offline', !settings.offline)}>
            <Toggle on={settings.offline} onToggle={() => update('offline', !settings.offline)} />
          </Row>
          <Row icon={settings.sound ? Volume2 : VolumeX} label="Voice output" sub="Read tutor answers aloud in the browser" onClick={() => update('sound', !settings.sound)}>
            <Toggle on={settings.sound} onToggle={() => update('sound', !settings.sound)} />
          </Row>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
          <h2 className="text-xs font-semibold text-ink/45 uppercase tracking-wider mb-3">Account</h2>
          <button
            onClick={() => {
              localStorage.removeItem('vp_guest')
              localStorage.removeItem('vp_session_id')
              localStorage.removeItem('vp_current_student')
            }}
            className="w-full text-left text-sm text-clay font-medium py-2 hover:underline"
          >
            Clear guest session
          </button>
          <Link href="/onboarding" className="block text-sm text-ink/55 py-2 hover:underline">
            Edit onboarding profile
          </Link>
        </motion.section>

        <p className="text-center text-xs text-ink/35 py-4">VoicePandita v0.1.0 - Student-only MVP</p>
      </main>
    </div>
  )
}
