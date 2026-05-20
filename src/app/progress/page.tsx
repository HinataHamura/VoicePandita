'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Target, TrendingDown } from 'lucide-react'
import { getCurrentStudent, getStudentProgress, type StudentIdentity, type StudentProgress } from '@/lib/studentStore'

export default function ProgressPage() {
  const [student, setStudent] = useState<StudentIdentity | null>(null)
  const [progress, setProgress] = useState<StudentProgress | null>(null)

  useEffect(() => {
    const current = getCurrentStudent()
    setStudent(current)
    setProgress(getStudentProgress(current.id))
  }, [])

  const data = progress || getStudentProgress(student?.id)

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-10 bg-cream/85 backdrop-blur-sm border-b border-black/5 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/learn" className="p-2 hover:bg-black/5 rounded-lg transition-colors" aria-label="Back to learn">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg">Progress</h1>
            <p className="text-xs text-ink/45">Skill DNA snapshot for {student?.isDemo ? 'judge demo' : student?.name || 'this student'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <section className="grid grid-cols-3 gap-3">
          {[
            ['Sessions', String(data.sessions)],
            ['Accuracy', `${data.accuracy}%`],
            ['Focus', `${data.focusTopics} topics`],
          ].map(([label, value]) => (
            <div key={label} className="card p-4 text-center">
              <div className="font-display text-2xl font-bold text-forest">{value}</div>
              <div className="text-xs text-ink/50">{label}</div>
            </div>
          ))}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={16} className="text-clay" />
            <h2 className="font-semibold text-ink/75 text-sm">Needs practice</h2>
          </div>
          <div className="space-y-3">
            {data.weakTopics.length === 0 && (
              <div className="card p-5 text-sm text-ink/55">
                Ask a few questions from Learn, then weak topics will appear here for this student.
              </div>
            )}
            {data.weakTopics.map((topic, index) => (
              <motion.div key={topic.topic} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="card p-5">
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div>
                    <span className="text-xs text-ink/45 font-medium">{topic.subject}</span>
                    <h3 className="font-semibold mt-0.5">{topic.topic}</h3>
                    <p className="text-xs text-ink/45 mt-1">{topic.sessions} practice sessions completed</p>
                  </div>
                  <span className="text-2xl font-display font-bold text-clay">{topic.score}%</span>
                </div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${topic.score}%` }} transition={{ delay: index * 0.06 + 0.2, duration: 0.6 }} className="h-full bg-clay rounded-full" />
                </div>
                <Link href={`/learn?q=${encodeURIComponent(topic.query)}`} className="mt-3 inline-flex items-center gap-1 text-xs text-saffron font-medium hover:underline">
                  <Target size={12} /> Practice this topic
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} className="text-forest" />
            <h2 className="font-semibold text-ink/75 text-sm">Strong areas</h2>
          </div>
          <div className="space-y-2">
            {data.strongTopics.length === 0 && (
              <div className="card p-4 text-sm text-ink/55">
                Strong areas will unlock as this student practices.
              </div>
            )}
            {data.strongTopics.map((topic, index) => (
              <motion.div key={topic.topic} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="card p-4 flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-xs text-ink/45">{topic.subject}</span>
                  <div className="font-semibold text-sm mt-0.5">{topic.topic}</div>
                </div>
                <div className="h-1.5 w-24 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-forest rounded-full" style={{ width: `${topic.score}%` }} />
                </div>
                <span className="text-sm font-mono font-bold text-forest">{topic.score}%</span>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
