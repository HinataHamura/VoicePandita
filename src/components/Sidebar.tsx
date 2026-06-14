'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, ClipboardCheck, Globe, History, Home, LogOut, Mic, Settings, Sparkles, TrendingUp, User, UserRoundPlus, Users, X } from 'lucide-react'
import { clearLocalAuthCookies, getVisibleStudent } from '@/lib/authFlow'
import { createClient, hasBrowserSupabaseConfig } from '@/lib/supabase/client'

const nav = [
  { href: '/', icon: Home, label: 'Home', sub: 'Overview' },
  { href: '/learn', icon: Mic, label: 'Learn', sub: 'Voice tutor' },
  { href: '/pricing', icon: Sparkles, label: 'Pricing', sub: 'Free and Pro' },
  { href: '/voice-practice', icon: Brain, label: 'Voice Practice', sub: 'Speak answers' },
  { href: '/answer-checker', icon: ClipboardCheck, label: 'Answer Checker', sub: 'Handwritten marks' },
  { href: '/history', icon: History, label: 'History', sub: 'Saved Q&A' },
  { href: '/profile', icon: User, label: 'Profile', sub: 'Student dashboard' },
  { href: '/progress', icon: TrendingUp, label: 'Student Analytics', sub: 'Learning signals' },
  { href: '/study-buddy', icon: UserRoundPlus, label: 'Bondhu Study Room', sub: 'AI group practice' },
  { href: '/pwn', icon: Users, label: 'Peer Wisdom', sub: 'Community hotspots' },
  { href: '/chakma', icon: Globe, label: 'Language Bridge', sub: 'Chakma, Marma, Garo' },
  { href: '/settings', icon: Settings, label: 'Settings', sub: 'Preferences' },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasActiveSession, setHasActiveSession] = useState(false)

  useEffect(() => {
    let isMounted = true

    getVisibleStudent()
      .then(student => {
        if (isMounted) setHasActiveSession(Boolean(student))
      })
      .catch(() => {
        if (isMounted) setHasActiveSession(false)
      })

    return () => {
      isMounted = false
    }
  }, [open])

  async function handleLogout() {
    clearLocalAuthCookies()
    localStorage.removeItem('vp_guest')
    localStorage.removeItem('vp_session_id')
    localStorage.removeItem('vp_current_student')
    if (hasBrowserSupabaseConfig()) {
      await createClient().auth.signOut().catch(() => undefined)
    }
    window.dispatchEvent(new Event('vp-auth-change'))
    onClose()
    router.replace('/login')
    router.refresh()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-md md:left-80"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 z-50 flex h-full w-80 max-w-[88vw] flex-col border-r border-white/70 bg-white/90 text-ink shadow-2xl shadow-slate-900/10 backdrop-blur-2xl"
          >
            <div className="border-b border-white/70 p-5">
              <div className="flex items-center justify-between">
                <Link href="/" onClick={onClose} className="flex items-center gap-3">
                  <Image src="/icon.jpg" alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover shadow-lg shadow-forest/20" />
                  <span className="font-display text-xl font-bold tracking-tight text-ink">Voice<span className="text-forest">Pandita</span></span>
                </Link>
                <button onClick={onClose} className="rounded-md border border-indigo/10 bg-white/80 p-2 text-ink/60 shadow-sm hover:scale-105 hover:bg-white hover:text-ink" aria-label="Close menu">
                <X size={18} />
                </button>
              </div>
              <div className="mt-4 rounded-md border border-forest/15 bg-gradient-to-br from-forest/10 via-white/70 to-saffron/10 p-3">
                <div className="text-xs font-bold uppercase text-forest">Demo mission</div>
                <p className="mt-1 text-xs leading-relaxed text-ink/60">Bangla-first, inclusive, low-bandwidth AI tutoring.</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {nav.map(item => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`group flex items-center gap-3 rounded-md border p-3 transition-all ${
                      active
                        ? 'border-forest/20 bg-white shadow-md shadow-forest/10'
                        : 'border-transparent hover:border-indigo/10 hover:bg-white/70 hover:shadow-sm'
                    }`}
                  >
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${
                      active
                        ? 'bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/20'
                        : 'bg-indigo/10 text-indigo group-hover:bg-gradient-to-br group-hover:from-forest group-hover:to-indigo group-hover:text-white'
                    }`}>
                      <item.icon size={17} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-ink">{item.label}</div>
                      <div className="text-xs font-medium text-ink/45">{item.sub}</div>
                    </div>
                  </Link>
                )
              })}
            </nav>
            <div className="space-y-3 border-t border-white/70 p-4">
              {hasActiveSession && (
                <button
                  onClick={handleLogout}
                  className="vp-logout-button flex w-full items-center gap-3 rounded-md p-3 text-sm font-bold"
                >
                  <LogOut size={18} />
                  <span>Log out</span>
                </button>
              )}
              <div className="text-center text-xs font-semibold text-ink/40">Calm AI learning space</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
