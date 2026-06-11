'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { getAuthenticatedStudent } from '@/lib/authFlow'
import { useStudyBuddyJoin } from '@/hooks/useStudyBuddyJoin'

const SUBJECTS = ['physics', 'chemistry', 'biology', 'math', 'bangla', 'english', 'general']
const LEVELS = ['ssc', 'hsc', 'admission', 'general']
const LANGUAGES = [
  { value: 'bn', label: 'Bangla' },
  { value: 'en', label: 'English' },
  { value: 'chakma', label: 'Chakma' },
  { value: 'marma', label: 'Marma' },
  { value: 'garo', label: 'Garo' },
] as const

export default function StudyBuddyPage() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_STUDY_BUDDY !== 'false'
  const { join, loading, error } = useStudyBuddyJoin()
  const [authLoading, setAuthLoading] = useState(true)
  const [questionText, setQuestionText] = useState('Newton-er second law keno F = ma hoy, example diye bujhte chai')
  const [conceptHint, setConceptHint] = useState("Newton's Second Law")
  const [subject, setSubject] = useState('physics')
  const [classLevel, setClassLevel] = useState('hsc')
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]['value']>('bn')

  useEffect(() => {
    getAuthenticatedStudent().then(student => {
      if (!student) {
        window.location.replace('/login?next=/study-buddy')
        return
      }
      setAuthLoading(false)
    })
  }, [])

  return (
    <div className="ai-shell min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Bondhu Study Room" subtitle="Collaborative AI practice room for small groups" backHref="/learn" backLabel="Back to learn" />

        <main className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border border-white/60 bg-white/82 p-6 shadow-2xl shadow-forest/10 backdrop-blur-xl">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-forest to-indigo text-white">
              <Users size={24} />
            </div>
            <h1 className="font-display text-3xl font-bold text-ink">Bondhu Study Room</h1>
            <p className="bangla mt-3 leading-7 text-ink/65">
              Same confusion নিয়ে 3-5 জন learner একসাথে safe room-এ practice করবে.
              AI host পাঁচ ধরনের concept check চালাবে: মূল ধারণা, বাস্তব উদাহরণ, common mistake, cause-effect, আর teach-a-friend.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['Safe', 'No free chat, only guided answers'],
                ['Varied', 'Different question styles, not the same MCQ again'],
                ['Useful', 'Hints, explanation, and revision focus at the end'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/70 bg-white/70 p-3">
                  <div className="text-sm font-semibold text-forest">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-ink/55">{body}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-forest" />
              <h2 className="font-semibold">Create or join a room</h2>
            </div>

            {authLoading ? (
              <div className="rounded-2xl bg-white/65 p-4 text-sm text-ink/55">
                <Loader2 size={16} className="mr-2 inline animate-spin text-forest" />
                Loading your student session...
              </div>
            ) : !enabled ? (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Bondhu Study Room is turned off. Set `NEXT_PUBLIC_ENABLE_STUDY_BUDDY=true` or remove the false value.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <select value={subject} onChange={event => setSubject(event.target.value)} className="rounded-2xl border border-white/70 bg-white/85 px-3 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none">
                    {SUBJECTS.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={classLevel} onChange={event => setClassLevel(event.target.value)} className="rounded-2xl border border-white/70 bg-white/85 px-3 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none">
                    {LEVELS.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                  </select>
                  <select value={language} onChange={event => setLanguage(event.target.value as typeof language)} className="rounded-2xl border border-white/70 bg-white/85 px-3 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none">
                    {LANGUAGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>

                <input
                  value={conceptHint}
                  onChange={event => setConceptHint(event.target.value)}
                  placeholder="Concept hint, e.g. Photosynthesis"
                  className="w-full rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none"
                />
                <textarea
                  value={questionText}
                  onChange={event => setQuestionText(event.target.value)}
                  placeholder="What are you confused about?"
                  className="bangla min-h-28 w-full resize-y rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => join({ questionText, subject, classLevel, language, emotionLabel: 'confused', conceptHint })}
                  disabled={loading || !questionText.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-forest to-indigo px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-forest/15 disabled:opacity-45"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                  Start Bondhu Room
                </button>
                {error && <p className="rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
