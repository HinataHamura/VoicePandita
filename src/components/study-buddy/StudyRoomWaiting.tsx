'use client'

import { motion } from 'framer-motion'
import { Users, Zap } from 'lucide-react'
import type { StudyRoomMember } from '@/lib/study-buddy/types'

export default function StudyRoomWaiting(props: {
  topicTitle: string
  members: StudyRoomMember[]
  minMembers: number
  waitExpired: boolean
  onSolo: () => void
}) {
  const needed = Math.max(0, props.minMembers - props.members.length)
  const filled = props.members.length
  const total = props.minMembers

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-2xl rounded-[2rem] border border-white/60 bg-white/88 p-8 text-center shadow-2xl shadow-forest/10 backdrop-blur-xl"
    >
      {/* Animated icon */}
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/25"
      >
        <Users size={28} />
      </motion.div>

      <h1 className="font-display text-2xl font-bold text-ink">Bondhu Study Room</h1>
      <p className="bangla mt-1.5 text-sm text-ink/55">{props.topicTitle}</p>

      {/* Member dots */}
      <div className="my-6 flex items-center justify-center gap-3">
        {Array.from({ length: total }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 400, damping: 20 }}
            className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
              i < filled
                ? 'border-forest bg-gradient-to-br from-forest to-indigo text-white shadow-md shadow-forest/25'
                : 'border-dashed border-ink/20 bg-white/50 text-ink/25'
            }`}
          >
            {i < filled ? (
              props.members[i]?.display_alias?.split(' ').map(w => w[0]).join('').slice(0, 2) || (i + 1)
            ) : (
              <span className="text-xs">?</span>
            )}
            {i < filled && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1 }}
                className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-forest"
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Status */}
      <div className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-forest/8 px-5 py-2.5 text-sm font-semibold text-forest">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="h-3.5 w-3.5 rounded-full border-2 border-forest border-t-transparent"
        />
        আরও {needed} জন student এলে room শুরু হবে
      </div>

      {/* Member aliases */}
      {props.members.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {props.members.map(m => (
            <span key={m.id} className="bangla rounded-full border border-forest/15 bg-forest/8 px-3 py-1 text-xs font-semibold text-forest">
              {m.display_alias}
            </span>
          ))}
        </div>
      )}

      {/* Solo fallback */}
      {props.waitExpired && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-3"
        >
          <p className="bangla text-sm text-ink/55">90 সেকেন্ড পার হয়েছে। এখনই Solo practice শুরু করতে পারো।</p>
          <button
            type="button"
            onClick={props.onSolo}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-forest to-indigo px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-forest/20"
          >
            <Zap size={15} />
            Solo AI Practice শুরু করো
          </button>
        </motion.div>
      )}

      <p className="bangla mt-5 text-xs leading-5 text-ink/35">Fake student দেখানো হয় না। Personal info share করো না।</p>
    </motion.section>
  )
}
