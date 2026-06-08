'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe, History, Home, LogOut, Mic, Settings, TrendingUp, User, UserRoundPlus, Users, X } from 'lucide-react'
import { clearDemoAuthCookie, clearGuestAuthCookie } from '@/lib/authFlow'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { href: '/', icon: Home, label: 'Home', sub: 'Overview' },
  { href: '/learn', icon: Mic, label: 'Learn', sub: 'Voice tutor' },
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

  async function handleLogout() {
    clearDemoAuthCookie()
    clearGuestAuthCookie()
    localStorage.removeItem('vp_guest')
    localStorage.removeItem('vp_session_id')
    localStorage.removeItem('vp_current_student')
    await createClient().auth.signOut()
    onClose()
    router.push('/login')
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[90] bg-slate-950/30 backdrop-blur-md" />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="glass-panel fixed left-0 top-0 z-[100] flex h-full w-80 max-w-[86vw] flex-col border-r border-white/50"
          >
            <div className="flex items-center justify-between border-b border-white/50 p-5">
              <span className="font-display text-xl font-bold tracking-tight">Voice<span className="bg-gradient-to-r from-forest to-indigo bg-clip-text text-transparent">Pandita</span></span>
              <button onClick={onClose} className="rounded-full border border-white/60 bg-white/70 p-2 shadow-sm hover:scale-105 hover:bg-white" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {nav.map(item => (
                <Link key={item.href} href={item.href} onClick={onClose} className="group flex items-center gap-3 rounded-2xl p-3 hover:bg-white/72 hover:shadow-lg hover:shadow-forest/10">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-forest/12 to-aqua/18 group-hover:scale-105 group-hover:from-forest group-hover:to-indigo">
                    <item.icon size={17} className="text-forest group-hover:text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold group-hover:text-forest">{item.label}</div>
                    <div className="text-xs text-ink/40">{item.sub}</div>
                  </div>
                </Link>
              ))}
            </nav>
            <div className="border-t border-white/50 p-4 space-y-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-sm font-medium text-clay hover:bg-white/72"
              >
                <LogOut size={18} />
                <span>Log out</span>
              </button>
              <div className="text-center text-xs text-ink/35">Calm AI learning space</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
