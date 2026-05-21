'use client'

import { motion } from 'framer-motion'
import { Accessibility, Hand } from 'lucide-react'

interface Props {
  active: boolean
  text: string
}

export default function BdslAvatar({ active, text }: Props) {
  if (!active) return null

  const tokens = text
    .replace(/[^\u0980-\u09FFa-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)

  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-forest">
        <Accessibility size={14} />
        BdSL Avatar Mode
      </div>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="relative mx-auto h-40 w-32 rounded-2xl bg-gradient-to-b from-paper to-white shadow-inner">
          <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="absolute left-1/2 top-5 h-14 w-14 -translate-x-1/2 rounded-full bg-forest/90" />
          <div className="absolute left-1/2 top-[78px] h-16 w-20 -translate-x-1/2 rounded-2xl bg-indigo/90" />
          <motion.div animate={{ rotate: [-18, 28, -18], x: [-3, 4, -3] }} transition={{ duration: 1.2, repeat: Infinity }} className="absolute left-3 top-[88px] h-10 w-5 origin-top rounded-full bg-saffron" />
          <motion.div animate={{ rotate: [18, -28, 18], x: [3, -4, 3] }} transition={{ duration: 1.2, repeat: Infinity }} className="absolute right-3 top-[88px] h-10 w-5 origin-top rounded-full bg-saffron" />
          <Hand size={20} className="absolute bottom-4 left-1/2 -translate-x-1/2 text-forest" />
        </div>
        <div>
          <p className="bangla text-sm leading-relaxed text-ink/65">
            Explanation text tokenized into demo BdSL keyframes. Final build can map these tokens to IsharaKotha sign motion clips.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tokens.map((token, index) => (
              <motion.span
                key={`${token}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-full bg-forest/8 px-2.5 py-1 text-xs text-forest"
              >
                {token}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
