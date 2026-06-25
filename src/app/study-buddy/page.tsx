'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Brain, Loader2, Sparkles, User, Users } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { getAuthenticatedStudent } from '@/lib/authFlow'
import { useStudyBuddyJoin } from '@/hooks/useStudyBuddyJoin'

const SUBJECTS = [
  { value: 'physics', label: 'পদার্থবিজ্ঞান' },
  { value: 'chemistry', label: 'রসায়ন' },
  { value: 'biology', label: 'জীববিজ্ঞান' },
  { value: 'math', label: 'গণিত' },
  { value: 'bangla', label: 'বাংলা' },
  { value: 'english', label: 'English' },
  { value: 'ict', label: 'ICT' },
  { value: 'general', label: 'সাধারণ' },
]

const LEVELS = [
  { value: 'ssc', label: 'SSC' },
  { value: 'hsc', label: 'HSC' },
  { value: 'admission', label: 'Admission' },
  { value: 'general', label: 'General' },
]

const LANGUAGES = [
  { value: 'bn', label: 'বাংলা' },
  { value: 'en', label: 'English' },
  { value: 'chakma', label: 'Chakma' },
  { value: 'marma', label: 'Marma' },
  { value: 'garo', label: 'Garo' },
] as const

type Mode = 'solo' | 'group'

const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  physics: ["Newton's Second Law", "Ohm's Law", 'Wave Motion', 'Refraction of Light'],
  chemistry: ['Ionic Bonding', 'Acid-Base Reaction', 'Periodic Table', 'Electrolysis'],
  biology: ['Photosynthesis', 'Cell Division', 'DNA Replication', 'Ecosystem'],
  math: ['Quadratic Equations', 'Trigonometry', 'Set Theory', 'Integration'],
  bangla: ['কারক ও বিভক্তি', 'সমাস', 'ছন্দ', 'উপসর্গ'],
  english: ['Tense', 'Passive Voice', 'Narration', 'Conditional Sentences'],
  ict: ['Networking', 'Database', 'Algorithm', 'Web Technology'],
  general: ['Critical Thinking', 'Problem Solving', 'Logic', 'General Science'],
}

export default function StudyBuddyPage() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_STUDY_BUDDY !== 'false'
  const { join, loading, error } = useStudyBuddyJoin()
  const [authLoading, setAuthLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('group')
  const [conceptHint, setConceptHint] = useState("Newton's Second Law")
  const [questionText, setQuestionText] = useState('Newton-er second law keno F = ma hoy, example diye bujhte chai')
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

  const suggestions = TOPIC_SUGGESTIONS[subject] || TOPIC_SUGGESTIONS.general

  function handleSubjectChange(val: string) {
    setSubject(val)
    const first = TOPIC_SUGGESTIONS[val]?.[0]
    if (first) setConceptHint(first)
  }

  return (
    <div className="ai-shell min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Bondhu Study Room" subtitle="AI-powered concept practice — solo or with classmates" backHref="/learn" backLabel="Back to learn" />

        <main className="space-y-5">
          {/* Mode selector */}
          <div className="flex gap-3">
            {([['solo', 'Solo Practice', User, 'নিজে নিজে AI quiz করো'], ['group', 'Group Room', Users, '3-5 জন একসাথে practice করো']] as const).map(([val, label, Icon, sub]) => (
              <motion.button
                key={val}
                type="button"
                onClick={() => setMode(val)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex flex-1 items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  mode === val
                    ? 'border-forest/30 bg-gradient-to-br from-forest/8 to-indigo/5 shadow-lg shadow-forest/10'
                    : 'border-white/60 bg-white/70 hover:bg-white/90'
                }`}
              >
                {mode === val && (
                  <motion.div
                    layoutId="mode-bg"
                    className="absolute inset-0 rounded-2xl border-2 border-forest/25"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  mode === val ? 'bg-gradient-to-br from-forest to-indigo text-white shadow-md' : 'bg-indigo/10 text-indigo'
                }`}>
                  <Icon size={18} />
                </div>
                <div className="relative min-w-0">
                  <div className={`font-bold ${mode === val ? 'text-forest' : 'text-ink'}`}>{label}</div>
                  <div className="bangla mt-0.5 text-xs text-ink/55">{sub}</div>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
            {/* Info panel */}
            <section className="rounded-[2rem] border border-white/60 bg-white/82 p-6 shadow-2xl shadow-forest/10 backdrop-blur-xl">
              <AnimatePresence mode="wait">
                {mode === 'group' ? (
                  <motion.div key="group" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/20">
                      <Users size={24} />
                    </div>
                    <h1 className="font-display text-2xl font-bold text-ink">Bondhu Group Room</h1>
                    <p className="bangla mt-3 leading-7 text-ink/65">
                      Same confusion নিয়ে 3-5 জন learner একসাথে safe room-এ practice করবে।
                      AI host পাঁচ ধরনের concept check চালাবে।
                    </p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      {[
                        ['🔒 Safe', 'No free chat — guided answers only'],
                        ['🎯 Varied', '5 different question styles per topic'],
                        ['📊 Score', 'Leaderboard + weak concept review'],
                      ].map(([title, body]) => (
                        <div key={title} className="rounded-2xl border border-forest/10 bg-forest/5 p-3">
                          <div className="text-sm font-semibold text-forest">{title}</div>
                          <div className="mt-1 text-xs leading-5 text-ink/55">{body}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 space-y-2">
                      <div className="text-xs font-black uppercase tracking-widest text-ink/30">5 ধরনের concept check</div>
                      {[
                        ['মূল ধারণা', 'নিজের ভাষায় বলো'],
                        ['বাস্তব উদাহরণ', 'দৈনন্দিন জীবনে প্রয়োগ'],
                        ['সাধারণ ভুল', 'কোথায় ভুল হয়?'],
                        ['কারণ-ফল', 'কেন এবং এর ফলে কী?'],
                        ['বন্ধুকে শেখাও', '৩০ সেকেন্ডে বোঝাও'],
                      ].map(([name, desc], i) => (
                        <div key={name} className="flex items-center gap-3">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-forest/15 text-xs font-bold text-forest">{i + 1}</div>
                          <span className="bangla text-sm font-semibold text-ink">{name}</span>
                          <span className="bangla text-xs text-ink/45">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="solo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo to-aqua text-white shadow-lg shadow-indigo/20">
                      <Brain size={24} />
                    </div>
                    <h1 className="font-display text-2xl font-bold text-ink">Solo AI Practice</h1>
                    <p className="bangla mt-3 leading-7 text-ink/65">
                      যেকোনো topic-এ AI একটি 5-প্রশ্নের quiz বানিয়ে দেবে। নিজের গতিতে উত্তর দাও, hint নাও, ব্যাখ্যা পড়ো।
                    </p>
                    <div className="mt-5 space-y-3">
                      <div className="text-xs font-black uppercase tracking-widest text-ink/30">কীভাবে কাজ করে</div>
                      {[
                        ['1', 'Topic আর subject বেছে নাও'],
                        ['2', 'AI তোমার level অনুযায়ী 5টা প্রশ্ন বানাবে'],
                        ['3', 'প্রতিটি উত্তরে explanation পাবে'],
                        ['4', 'শেষে weak concept list দেখবে'],
                      ].map(([num, text]) => (
                        <div key={num} className="flex items-start gap-3">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo/15 text-xs font-bold text-indigo">{num}</div>
                          <span className="bangla text-sm text-ink/70">{text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center gap-2 rounded-2xl border border-saffron/20 bg-saffron/8 p-3">
                      <BookOpen size={16} className="flex-shrink-0 text-orange-600" />
                      <p className="bangla text-xs leading-5 text-orange-700">Solo mode-এ room-এ join করতে হবে না — সঙ্গে সঙ্গে quiz শুরু হবে।</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Form panel */}
            <section className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-forest" />
                <h2 className="font-semibold text-ink">
                  {mode === 'solo' ? 'Quiz তৈরি করো' : 'Room খোলো বা join করো'}
                </h2>
              </div>

              {authLoading ? (
                <div className="flex items-center gap-2 rounded-2xl bg-white/65 p-4 text-sm text-ink/55">
                  <Loader2 size={16} className="animate-spin text-forest" />
                  Loading session...
                </div>
              ) : !enabled ? (
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Bondhu Study Room is off. Set <code>NEXT_PUBLIC_ENABLE_STUDY_BUDDY=true</code>.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Subject */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink/50">বিষয়</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {SUBJECTS.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => handleSubjectChange(s.value)}
                          className={`bangla rounded-xl border px-2 py-2 text-xs font-semibold transition-all ${
                            subject === s.value
                              ? 'border-forest/30 bg-forest text-white shadow-sm'
                              : 'border-white/60 bg-white/70 text-ink/65 hover:bg-white'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Level + Language */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-ink/50">Level</label>
                      <div className="flex gap-1.5">
                        {LEVELS.map(l => (
                          <button
                            key={l.value}
                            type="button"
                            onClick={() => setClassLevel(l.value)}
                            className={`flex-1 rounded-xl border px-2 py-2 text-xs font-bold transition-all ${
                              classLevel === l.value
                                ? 'border-indigo/30 bg-indigo text-white shadow-sm'
                                : 'border-white/60 bg-white/70 text-ink/65 hover:bg-white'
                            }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-ink/50">ভাষা</label>
                      <select
                        value={language}
                        onChange={e => setLanguage(e.target.value as typeof language)}
                        className="w-full rounded-xl border border-white/60 bg-white/85 px-3 py-2.5 text-xs font-semibold shadow-sm focus:border-forest/30 focus:outline-none"
                      >
                        {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Topic / Concept */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink/50">Topic</label>
                    <input
                      value={conceptHint}
                      onChange={e => setConceptHint(e.target.value)}
                      placeholder="e.g. Photosynthesis, Quadratic Equations"
                      className="w-full rounded-xl border border-white/60 bg-white/85 px-3 py-2.5 text-sm shadow-sm focus:border-forest/30 focus:outline-none"
                    />
                    {/* Suggestions */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {suggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setConceptHint(s)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                            conceptHint === s
                              ? 'border-forest/30 bg-forest/10 text-forest'
                              : 'border-white/60 bg-white/60 text-ink/50 hover:text-ink'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Confusion text */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink/50">কোথায় বুঝছো না? <span className="font-normal text-ink/35">(optional)</span></label>
                    <textarea
                      value={questionText}
                      onChange={e => setQuestionText(e.target.value)}
                      placeholder="যেমন: force আর acceleration এর সম্পর্ক কেন সরল?"
                      className="bangla min-h-[72px] w-full resize-y rounded-xl border border-white/60 bg-white/85 px-3 py-2.5 text-sm leading-relaxed shadow-sm focus:border-forest/30 focus:outline-none"
                    />
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => join({
                      questionText: questionText || conceptHint,
                      subject,
                      classLevel,
                      language,
                      emotionLabel: 'confused',
                      conceptHint,
                      ...(mode === 'solo' ? { solo: true } : {}),
                    } as Parameters<typeof join>[0])}
                    disabled={loading || !conceptHint.trim()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-forest to-indigo px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-forest/20 disabled:opacity-45"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : mode === 'solo' ? (
                      <Brain size={16} />
                    ) : (
                      <Users size={16} />
                    )}
                    {loading
                      ? 'Quiz তৈরি হচ্ছে…'
                      : mode === 'solo'
                      ? 'Solo Quiz শুরু করো'
                      : 'Group Room খোলো'}
                  </motion.button>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
