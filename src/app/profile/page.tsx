'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Award, BookOpen, ChevronRight, Flame, Mic, TrendingUp, User } from 'lucide-react'

interface Profile {
  level?: string
  goal?: string
  english?: string
  resume?: string
  interview?: string
}

const labels: Record<string, string> = {
  hsc: 'HSC',
  university: 'University',
  graduate: 'Graduate',
  job: 'Job seeker',
  admission: 'Admission',
  skill: 'Skill building',
  english: 'English',
  weak: 'Very weak',
  moderate: 'Moderate',
  good: 'Good',
}

function safeProfile(): Profile {
  try {
    const saved = localStorage.getItem('vp_profile')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({})

  useEffect(() => {
    setProfile(safeProfile())
  }, [])

  const track = useMemo(() => {
    if (profile.level === 'hsc' || profile.goal === 'admission') return 'Visual Answer Engine'
    if (profile.level) return 'English + Career Track'
    return 'Student learning track'
  }, [profile])

  const hasProfile = Object.keys(profile).length > 0

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-10 bg-cream/85 backdrop-blur-sm border-b border-black/5 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/learn" className="font-display font-bold text-lg">
            Voice<span className="text-saffron">Pandita</span>
          </Link>
          <Link href="/learn" className="flex items-center gap-1.5 bg-saffron text-white text-sm px-4 py-2 rounded-full font-medium">
            <Mic size={14} />
            Ask
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card p-6 bg-forest text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm mb-1">Student profile</p>
              <h1 className="font-display text-2xl font-bold">Your learning journey</h1>
              <p className="text-white/75 text-sm mt-2">{track}</p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
              <Flame size={14} className="text-saffron" />
              <span className="text-sm font-semibold">7 day streak</span>
            </div>
          </div>
        </motion.section>

        {!hasProfile && (
          <section className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-saffron/10 rounded-xl flex items-center justify-center">
              <User size={18} className="text-saffron" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Onboarding not completed</div>
              <p className="text-sm text-ink/55">Answer five quick questions so VoicePandita can personalize your track.</p>
            </div>
            <Link href="/onboarding" className="text-sm text-saffron font-semibold">Start</Link>
          </section>
        )}

        <section className="grid grid-cols-3 gap-3">
          {[
            { icon: BookOpen, label: 'Questions', value: '47' },
            { icon: TrendingUp, label: 'Avg score', value: '82%' },
            { icon: Award, label: 'Badges', value: '4' },
          ].map((stat, index) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="card p-4 text-center">
              <stat.icon size={20} className="text-saffron mx-auto mb-2" />
              <div className="font-display text-xl font-bold">{stat.value}</div>
              <div className="text-xs text-ink/50 mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-4">Learning setup</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ['Level', labels[profile.level || ''] || 'Not set'],
              ['Goal', labels[profile.goal || ''] || 'Not set'],
              ['English', labels[profile.english || ''] || 'Not set'],
              ['Track', track],
            ].map(([key, value]) => (
              <div key={key} className="rounded-lg bg-paper px-4 py-3">
                <div className="text-xs text-ink/45">{key}</div>
                <div className="font-medium mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          {[
            { href: '/learn', title: 'Ask a new question', sub: 'Voice, text or photo input', icon: Mic },
            { href: '/progress', title: 'Review progress', sub: 'Weak topics and next practice', icon: TrendingUp },
            { href: '/pwn', title: 'Peer Wisdom Network', sub: 'See common confusion hotspots', icon: BookOpen },
          ].map(action => (
            <Link key={action.href} href={action.href} className="card p-4 flex items-center gap-4 hover:border-saffron/30 transition-colors">
              <div className="w-10 h-10 bg-saffron/10 rounded-xl flex items-center justify-center">
                <action.icon size={18} className="text-saffron" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{action.title}</div>
                <div className="text-xs text-ink/50">{action.sub}</div>
              </div>
              <ChevronRight size={16} className="text-ink/30" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
