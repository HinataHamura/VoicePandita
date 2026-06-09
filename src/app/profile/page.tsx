'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Award, BookOpen, ChevronRight, Flame, Mic, TrendingUp, User } from 'lucide-react'
import type { StudentProfile } from '@/types'
import { getCurrentStudent, getStudentProfile, getStudentProgress, type StudentIdentity, type StudentProgress } from '@/lib/studentStore'

const labels: Record<string, string> = {
  ssc: 'SSC',
  hsc: 'HSC',
  board: 'Board Exam',
  admission: 'Admission',
  science: 'Science',
  humanities: 'Humanities',
  business: 'Business Studies',
}

export default function ProfilePage() {
  const [student, setStudent] = useState<StudentIdentity | null>(null)
  const [profile, setProfile] = useState<Partial<StudentProfile>>({})
  const [progress, setProgress] = useState<StudentProgress | null>(null)

  useEffect(() => {
    const current = getCurrentStudent()
    setStudent(current)
    setProfile(getStudentProfile(current.id))
    setProgress(getStudentProgress(current.id))
  }, [])

  const track = useMemo(() => {
    if (profile.goal === 'admission') return 'Admission GraphRAG Track'
    if (profile.level === 'ssc' || profile.level === 'hsc') return 'Board Exam Visual Track'
    if (profile.level) return 'English + Career Track'
    return 'Student learning track'
  }, [profile])

  const hasProfile = Object.keys(profile).length > 0
  const stats = progress || getStudentProgress(student?.id)

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/learn" className="font-display text-lg font-bold">
            Voice<span className="bg-gradient-to-r from-forest to-indigo bg-clip-text text-transparent">Pandita</span>
          </Link>
          <Link href="/learn" className="soft-button flex items-center gap-1.5 px-4 py-2 text-sm font-medium">
            <Mic size={14} />
            Ask
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/30 bg-gradient-to-br from-forest via-indigo to-lavender p-7 text-white shadow-2xl shadow-forest/20"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/70 mb-1">Student profile</p>
              <h1 className="font-display text-3xl font-bold">{student?.name || 'Your learning journey'}</h1>
              <p className="text-white/75 text-sm mt-2">{student?.email || track}</p>
              <p className="text-white/70 text-xs mt-1">{track}</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1.5 backdrop-blur-sm">
              <Flame size={14} className="text-gold" />
              <span className="text-sm font-semibold">{stats.streak} day streak</span>
            </div>
          </div>
          {student?.isDemo && (
            <div className="mt-4 inline-flex rounded-full bg-white/18 px-3 py-1 text-xs font-semibold text-white">
              Judge demo profile
            </div>
          )}
        </motion.section>

        {!hasProfile && (
          <section className="card p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest/10">
              <User size={18} className="text-forest" />
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
            { icon: BookOpen, label: 'Questions', value: String(stats.questions) },
            { icon: TrendingUp, label: 'Avg score', value: `${stats.avgScore}%` },
            { icon: Award, label: 'Badges', value: String(stats.badges) },
          ].map((stat, index) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="card p-4 text-center">
              <stat.icon size={20} className="text-forest mx-auto mb-2" />
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
              ['Group', labels[profile.group || ''] || 'Not set'],
              ['Track', track],
            ].map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/60 bg-white/60 px-4 py-3 shadow-sm shadow-forest/5">
                <div className="text-xs text-ink/45">{key}</div>
                <div className="font-medium mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          {[
            { href: '/learn', title: 'Ask a new question', sub: 'Voice, text or photo input', icon: Mic },
            { href: '/progress', title: 'Student Analytics Dashboard', sub: 'Learning signals and next steps', icon: TrendingUp },
            { href: '/pwn', title: 'Peer Wisdom Network', sub: 'See common confusion hotspots', icon: BookOpen },
          ].map(action => (
            <Link key={action.href} href={action.href} className="card p-4 flex items-center gap-4 hover:border-forest/30 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-forest/12 to-aqua/25">
                <action.icon size={18} className="text-forest" />
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
