'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe, Home, Mic, Settings, TrendingUp, User, Users, X } from 'lucide-react'

const nav = [
  { href: '/', icon: Home, label: 'Home', sub: 'Overview' },
  { href: '/learn', icon: Mic, label: 'Learn', sub: 'Voice tutor' },
  { href: '/profile', icon: User, label: 'Profile', sub: 'Student dashboard' },
  { href: '/progress', icon: TrendingUp, label: 'Progress', sub: 'Weak topics' },
  { href: '/pwn', icon: Users, label: 'Peer Wisdom', sub: 'Community hotspots' },
  { href: '/chakma', icon: Globe, label: 'Language Bridge', sub: 'Chakma, Marma, Garo' },
  { href: '/settings', icon: Settings, label: 'Settings', sub: 'Preferences' },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-72 bg-cream z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-black/5">
              <span className="font-display font-bold text-xl">Voice<span className="text-saffron">Pandita</span></span>
              <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-lg" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {nav.map(item => (
                <Link key={item.href} href={item.href} onClick={onClose} className="flex items-center gap-3 p-3 rounded-xl hover:bg-saffron/5 transition-colors group">
                  <div className="w-9 h-9 bg-black/5 group-hover:bg-saffron/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <item.icon size={17} className="text-ink/60 group-hover:text-saffron transition-colors" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold group-hover:text-saffron transition-colors">{item.label}</div>
                    <div className="text-xs text-ink/40">{item.sub}</div>
                  </div>
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-black/5">
              <div className="text-xs text-ink/35 text-center">Student-only MVP</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
