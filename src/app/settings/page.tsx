'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Globe, Moon, Sun, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'
import { clearDemoAuthCookie } from '@/lib/authFlow'
import { createClient } from '@/lib/supabase/client'

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

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-gradient-to-r from-forest to-indigo' : 'bg-slate-300/70'}`} aria-pressed={on}>
      <motion.span animate={{ x: on ? 20 : 2 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow" />
    </button>
  )
}

function Row({ icon: Icon, label, sub, children }: { icon: any; label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-forest/10 to-aqua/25">
          <Icon size={16} className="text-forest" />
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
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vp_settings')
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) })
    } catch {
      setSettings(defaultSettings)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('vp_settings', JSON.stringify(settings))
    document.documentElement.classList.toggle('vp-dark', settings.dark)
  }, [settings])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  async function logout() {
    clearDemoAuthCookie()
    localStorage.removeItem('vp_guest')
    localStorage.removeItem('vp_session_id')
    localStorage.removeItem('vp_current_student')
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/learn" className="rounded-2xl border border-white/60 bg-white/72 p-2 shadow-sm shadow-forest/5 hover:scale-105 hover:bg-white" aria-label="Back to learn">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg">Settings</h1>
            <p className="text-xs text-ink/45">Local app preferences</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <h2 className="text-xs font-semibold text-ink/45 uppercase tracking-wider mb-2">Language and display</h2>
          <Row icon={Globe} label="Language" sub="Used by the tutor screen">
            <select value={settings.lang} onChange={event => update('lang', event.target.value)} className="rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-sm shadow-sm focus:outline-none">
              <option value="bn">Bangla</option>
              <option value="ckm">Chakma</option>
              <option value="mrm">Marma</option>
              <option value="gnk">Garo</option>
              <option value="en">English</option>
            </select>
          </Row>
          <Row icon={settings.dark ? Moon : Sun} label="Dark mode" sub="High contrast reading preference">
            <Toggle on={settings.dark} onToggle={() => update('dark', !settings.dark)} />
          </Row>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
          <h2 className="text-xs font-semibold text-ink/45 uppercase tracking-wider mb-2">Connection and sound</h2>
          <Row icon={settings.offline ? WifiOff : Wifi} label="Prefer offline pack" sub="Use cached answers first on weak networks">
            <Toggle on={settings.offline} onToggle={() => update('offline', !settings.offline)} />
          </Row>
          <Row icon={settings.sound ? Volume2 : VolumeX} label="Voice output" sub="Read tutor answers aloud in the browser">
            <Toggle on={settings.sound} onToggle={() => update('sound', !settings.sound)} />
          </Row>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
          <h2 className="text-xs font-semibold text-ink/45 uppercase tracking-wider mb-3">Account</h2>
          <button
            onClick={logout}
            className="w-full rounded-2xl bg-clay/10 px-4 py-3 text-left text-sm font-semibold text-clay hover:bg-clay/15"
          >
            Log out
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
