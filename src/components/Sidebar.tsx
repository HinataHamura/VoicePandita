'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe, History, Home, LogOut, Mic, Settings, TrendingUp, User, Users, X } from 'lucide-react'
import { clearDemoAuthCookie } from '@/lib/authFlow'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { href: '/', icon: Home, label: 'Home', sub: 'Overview' },
  { href: '/learn', icon: Mic, label: 'Learn', sub: 'Voice tutor' },
  { href: '/history', icon: History, label: 'History', sub: 'Saved Q&A' },
  { href: '/profile', icon: User, label: 'Profile', sub: 'Student dashboard' },
  { href: '/progress', icon: TrendingUp, label: 'Progress', sub: 'Weak topics' },
  { href: '/pwn', icon: Users, label: 'Peer Wisdom', sub: 'Community hotspots' },
  { href: '/chakma', icon: Globe, label: 'Language Bridge', sub: 'Chakma, Marma, Garo' },
  { href: '/settings', icon: Settings, label: 'Settings', sub: 'Preferences' },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const router = useRouter()

  async function handleLogout() {
    clearDemoAuthCookie()
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink/32 backdrop-blur-sm" />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-forest/10 bg-cream/95 shadow-2xl shadow-ink/12 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-forest/10 p-5">
              <span className="font-display font-bold text-xl">Voice<span className="text-saffron">Pandita</span></span>
              <button onClick={onClose} className="rounded-lg border border-forest/10 bg-white/70 p-1.5 hover:bg-paper/80" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {nav.map(item => (
                <Link key={item.href} href={item.href} onClick={onClose} className="group flex items-center gap-3 rounded-lg p-3 hover:bg-white/70 hover:shadow-sm">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-forest/8 group-hover:bg-saffron/10">
                    <item.icon size={17} className="text-ink/60 group-hover:text-saffron" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold group-hover:text-saffron">{item.label}</div>
                    <div className="text-xs text-ink/40">{item.sub}</div>
                  </div>
                </Link>
              ))}
            </nav>
            <div className="border-t border-forest/10 p-4 space-y-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-clay font-medium hover:bg-red-50 transition-colors text-sm"
              >
                <LogOut size={18} />
                <span>Log out</span>
              </button>
              <div className="text-xs text-ink/35 text-center">Student-only MVP</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
