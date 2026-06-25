'use client'

import { motion } from 'framer-motion'

const MOVE_NAMES = ['মূল ধারণা', 'বাস্তব উদাহরণ', 'সাধারণ ভুল', 'কারণ-ফল', 'বন্ধুকে শেখাও']

export default function StudyRoomProgress({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / Math.max(1, total)) * 100))
  const currentName = MOVE_NAMES[current - 1] ?? `Concept ${current}`

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="bangla text-xs font-bold text-forest">{currentName}</span>
        <span className="text-xs font-semibold text-ink/45">{current}/{total}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-forest/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-forest to-indigo"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i < current - 1 ? 'bg-forest' : i === current - 1 ? 'bg-indigo' : 'bg-ink/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
