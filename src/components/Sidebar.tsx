'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, ClipboardCheck, Globe, History, Home, LogOut, Mic, Settings, Sparkles, TrendingUp, User, UserRoundPlus, Users, X, Check } from 'lucide-react'
import { clearLocalAuthCookies, getVisibleStudent } from '@/lib/authFlow'
import { createClient, hasBrowserSupabaseConfig } from '@/lib/supabase/client'
import type { StudentIdentity } from '@/lib/studentStore'

const navGroups = [
  {
    label: 'শেখো',
    items: [
      { href: '/', icon: Home, label: 'Home', sub: 'Overview' },
      { href: '/learn', icon: Mic, label: 'Learn', sub: 'Voice tutor' },
      { href: '/voice-practice', icon: Brain, label: 'Voice Practice', sub: 'Speak answers' },
      { href: '/answer-checker', icon: ClipboardCheck, label: 'Answer Checker', sub: 'Handwritten marks' },
    ],
  },
  {
    label: 'কমিউনিটি',
    items: [
      { href: '/study-buddy', icon: UserRoundPlus, label: 'Bondhu Study Room', sub: 'AI group practice' },
      { href: '/pwn', icon: Users, label: 'Peer Wisdom', sub: 'Community hotspots' },
    ],
  },
  {
    label: 'অগ্রগতি',
    items: [
      { href: '/history', icon: History, label: 'History', sub: 'Saved Q&A' },
      { href: '/progress', icon: TrendingUp, label: 'Student Analytics', sub: 'Learning signals' },
      { href: '/profile', icon: User, label: 'Profile', sub: 'Student dashboard' },
    ],
  },
  {
    label: 'টুলস',
    items: [
      { href: '/chakma', icon: Globe, label: 'Language Bridge', sub: 'Chakma, Marma, Garo' },
      { href: '/pricing', icon: Sparkles, label: 'Pricing', sub: 'Free and Pro' },
      { href: '/settings', icon: Settings, label: 'Settings', sub: 'Preferences' },
    ],
  },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [student, setStudent] = useState<StudentIdentity | null>(null)

  useEffect(() => {
    let isMounted = true
    getVisibleStudent()
      .then(s => {
        if (!isMounted) return
        setHasActiveSession(Boolean(s))
        setStudent(s)
      })
      .catch(() => { if (isMounted) setHasActiveSession(false) })
    return () => { isMounted = false }
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
            className="fixed left-0 top-0 z-50 flex h-full w-80 max-w-[88vw] flex-col text-ink shadow-2xl shadow-slate-900/10"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(238,243,255,0.94) 100%)',
              backdropFilter: 'blur(32px) saturate(1.2)',
              borderRight: '1px solid rgba(255,255,255,0.7)',
              boxShadow: 'inset -1px 0 0 rgba(79,70,229,0.08), 0 24px 64px rgba(23,32,51,0.14)',
            }}
          >
            {/* Header */}
            <div className="border-b border-white/70 p-5">
              <div className="flex items-center justify-between">
                <Link href="/" onClick={onClose} className="flex items-center gap-3">
                  <Image src="/icon.jpg" alt="" width={40} height={40} className="h-10 w-10 rounded-md object-cover shadow-lg shadow-forest/20" />
                  <span className="font-display text-xl font-bold tracking-tight text-ink">
                    Voice<span className="text-gradient-brand">Pandita</span>
                  </span>
                </Link>
                <button
                  onClick={onClose}
                  className="rounded-md border border-indigo/10 bg-white/80 p-2 text-ink/60 shadow-sm hover:scale-105 hover:bg-white hover:text-ink"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Profile mini-card */}
              {student ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-forest/15 bg-gradient-to-br from-forest/8 to-indigo/5 p-3">
                  <div className="profile-avatar">
                    {getInitials(student.name || 'VP')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{student.name || 'শিক্ষার্থী'}</div>
                    <div className="text-xs font-medium text-ink/45">
                      {student.isDemo ? 'Demo' : student.isGuest ? 'Guest' : 'Student'}
                    </div>
                  </div>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-forest/15">
                    <Check size={11} className="text-forest" />
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-forest/15 bg-gradient-to-br from-forest/10 via-white/70 to-saffron/10 p-3">
                  <div className="text-xs font-bold uppercase text-forest">Demo mission</div>
                  <p className="mt-1 text-xs leading-relaxed text-ink/60">Bangla-first, inclusive, low-bandwidth AI tutoring.</p>
                </div>
              )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-2">
              {navGroups.map((group, gi) => (
                <div key={gi}>
                  <div className="nav-section-label bangla">{group.label}</div>
                  <div className="px-3 pb-1">
                    {group.items.map(item => {
                      const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                      return (
                        <motion.div
                          key={item.href}
                          initial="rest"
                          whileHover="hover"
                          animate="rest"
                          variants={{ rest: { x: 0 }, hover: { x: 2 } }}
                          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                        >
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={`group relative flex items-center gap-3 rounded-lg p-2.5 mb-0.5 transition-all ${
                              active
                                ? 'vp-nav-active'
                                : 'border border-transparent hover:border-indigo/8 hover:bg-white/70'
                            }`}
                          >
                            {active && (
                              <motion.div
                                layoutId="sidebar-active-bg"
                                className="absolute inset-0 rounded-lg"
                                style={{ background: 'linear-gradient(90deg, rgba(18,162,139,0.08), transparent)' }}
                                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                              />
                            )}
                            <div className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
                              active
                                ? 'bg-gradient-to-br from-forest to-indigo text-white shadow-md shadow-forest/25'
                                : 'bg-indigo/8 text-indigo group-hover:bg-gradient-to-br group-hover:from-forest group-hover:to-indigo group-hover:text-white'
                            }`}>
                              <item.icon size={16} />
                            </div>
                            <div className="relative min-w-0">
                              <div className={`text-sm font-bold ${active ? 'text-forest' : 'text-ink'}`}>{item.label}</div>
                              <div className="text-xs font-medium text-ink/40">{item.sub}</div>
                            </div>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="space-y-3 border-t border-white/70 p-4">
              {hasActiveSession && (
                <button
                  onClick={handleLogout}
                  className="vp-logout-button flex w-full items-center gap-3 rounded-lg p-3 text-sm font-bold"
                >
                  <LogOut size={18} />
                  <span>Log out</span>
                </button>
              )}
              <div className="text-center text-xs font-semibold text-ink/35">Calm AI learning space ✦</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
