'use client'

import { useEffect, useRef } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { BookOpenCheck, RotateCcw, Sparkles } from 'lucide-react'

function ScoreRing({ score, total }: { score: number; total: number }) {
  const percent = total > 0 ? score / total : 0
  const R = 52
  const circumference = 2 * Math.PI * R
  const spring = useSpring(0, { stiffness: 60, damping: 18 })
  const dashOffset = useTransform(spring, v => circumference * (1 - v))

  useEffect(() => { spring.set(percent) }, [percent, spring])

  const color = percent >= 0.8 ? '#12A28B' : percent >= 0.5 ? '#F59E0B' : '#EF5B5B'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(23,32,51,0.07)" strokeWidth="10" />
        <motion.circle
          cx="64" cy="64" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset, rotate: -90, transformOrigin: '64px 64px' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-black text-ink">{score}</span>
        <span className="text-xs font-semibold text-ink/40">of {total}</span>
      </div>
    </div>
  )
}

export default function StudyRoomSummary({
  topicTitle,
  score,
  total,
  weakConcepts = [],
}: {
  topicTitle: string
  score?: number
  total?: number
  weakConcepts?: string[]
}) {
  const hasScore = typeof score === 'number' && typeof total === 'number'
  const percent = hasScore ? Math.round(((score!) / total!) * 100) : 0
  const correct = score ?? 0
  const revise = hasScore ? Math.max(0, total! - correct) : 0

  const getMessage = () => {
    if (!hasScore) return 'অনুশীলন শেষ!'
    if (percent >= 80) return 'অসাধারণ! তুমি concept-টা ভালোভাবে বুঝেছ। 🎉'
    if (percent >= 60) return 'ভালো করেছ! কিছু concept আরেকটু দেখলেই পারফেক্ট হবে।'
    return 'চেষ্টা ভালো ছিল! নিচের concept গুলো আবার দেখো।'
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[2rem] border border-forest/15 bg-white/88 p-6 shadow-xl shadow-forest/10"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/10 text-forest">
            <BookOpenCheck size={22} />
          </div>
          <h2 className="bangla font-display text-2xl font-bold text-ink">আজকে তুমি যা শিখলে</h2>
          <p className="bangla mt-1 text-sm text-ink/55">{topicTitle}</p>
        </div>
        {hasScore && <ScoreRing score={correct} total={total!} />}
      </div>

      {/* Message */}
      <p className="bangla mt-4 rounded-2xl border border-forest/10 bg-forest/5 px-4 py-3 text-sm leading-6 text-ink/70">
        {getMessage()}
      </p>

      {/* Stats grid */}
      {hasScore && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-forest/8 p-3 text-center">
            <div className="font-display text-2xl font-bold text-forest">{correct}</div>
            <div className="mt-0.5 text-xs text-ink/50">সঠিক</div>
          </div>
          <div className="rounded-2xl bg-indigo/8 p-3 text-center">
            <div className="font-display text-2xl font-bold text-indigo">{percent}%</div>
            <div className="mt-0.5 text-xs text-ink/50">Score</div>
          </div>
          <div className="rounded-2xl bg-saffron/10 p-3 text-center">
            <div className="font-display text-2xl font-bold text-orange-600">{revise}</div>
            <div className="mt-0.5 text-xs text-ink/50">Revise করো</div>
          </div>
        </div>
      )}

      {/* 5 moves summary */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-ink/30">এই session-এ অনুশীলন হয়েছে</div>
        <div className="flex flex-wrap gap-1.5">
          {['মূল ধারণা', 'বাস্তব উদাহরণ', 'সাধারণ ভুল', 'কারণ-ফল', 'বন্ধুকে শেখানো'].map((move, i) => (
            <span key={move} className="rounded-full bg-forest/8 px-3 py-1 text-xs font-semibold text-forest">
              {i + 1}. {move}
            </span>
          ))}
        </div>
      </div>

      {/* Weak concepts */}
      {weakConcepts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-ink/30">আবার দেখো</div>
          <div className="flex flex-wrap gap-2">
            {weakConcepts.map((concept, i) => (
              <motion.span
                key={`${concept}-${i}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 400 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-clay/20 bg-clay/8 px-3 py-1 text-xs font-medium text-clay"
              >
                <Sparkles size={10} />
                {concept}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href="/study-buddy"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-forest/15"
        >
          <RotateCcw size={14} />
          আরেকটা room
        </a>
        <a
          href="/learn"
          className="rounded-xl border border-forest/20 bg-white px-4 py-2.5 text-sm font-bold text-forest hover:bg-forest/5"
        >
          Learn এ ফিরে যাও
        </a>
        <a
          href="/progress"
          className="rounded-xl border border-indigo/20 bg-white px-4 py-2.5 text-sm font-bold text-indigo hover:bg-indigo/5"
        >
          Analytics দেখো
        </a>
      </div>
    </motion.section>
  )
}
