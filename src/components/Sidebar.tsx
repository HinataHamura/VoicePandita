'use client'

import { usePathname, useRouter } from 'next/navigation'
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
  const pathname = usePathname()

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:left-80"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 z-50 flex h-full w-80 max-w-[86vw] flex-col border-r border-slate-200/60 bg-white/90 text-slate-900 shadow-2xl shadow-slate-900/10 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/40 p-5">
              <span className="font-display text-xl font-bold tracking-tight text-slate-900">Voice<span className="text-indigo-500">Pandita</span></span>
              <button onClick={onClose} className="rounded-full border border-slate-200/70 bg-white/80 p-2 text-slate-600 shadow-sm hover:scale-105 hover:bg-white hover:text-slate-900" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {nav.map(item => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`group flex items-center gap-3 rounded-2xl p-3 transition-colors ${active ? 'bg-indigo-100/70' : 'hover:bg-indigo-50'}`}
                  >
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white'}`}>
                      <item.icon size={17} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.sub}</div>
                    </div>
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-slate-200/60 p-4 space-y-3">
              <button
                onClick={handleLogout}
                className="vp-logout-button flex w-full items-center gap-3 rounded-2xl p-3 text-sm font-medium"
              >
                <LogOut size={18} />
                <span>Log out</span>
              </button>
              <div className="text-center text-xs text-slate-500">Calm AI learning space</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
