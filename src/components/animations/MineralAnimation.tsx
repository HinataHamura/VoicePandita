'use client'

import { motion } from 'framer-motion'
import { DrawArrow, StepCard, TeachingShell } from './primitives'
import type { TeachingAnimationProps } from './types'

export default function MineralAnimation(_: TeachingAnimationProps) {
  const nodes = [
    ['Hardness', 'top-[18%] left-[8%]'],
    ['Crystal shape', 'top-[7%] right-[12%]'],
    ['Natural source', 'bottom-[18%] left-[10%]'],
    ['Examples', 'bottom-[12%] right-[10%]'],
  ]

  return (
    <TeachingShell title="Mineral Concept" subtitle="Minerals are natural substances from Earth. Layers, crystals, properties, and examples reveal the idea step by step.">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_.9fr]">
        <div className="relative min-h-[330px] overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-b from-sky-50 via-white to-orange-50 p-4">
          <div className="absolute bottom-0 left-0 right-0 h-48">
            {[
              ['h-48 bg-amber-900/80', 0],
              ['h-36 bg-orange-700/75', 0.18],
              ['h-24 bg-amber-500/70', 0.36],
              ['h-14 bg-emerald-700/60', 0.54],
            ].map(([klass, delay]) => (
              <motion.div
                key={klass}
                initial={{ scaleY: 0, transformOrigin: 'bottom' }}
                animate={{ scaleY: 1 }}
                transition={{ delay: Number(delay), duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute bottom-0 left-0 right-0 ${klass as string}`}
              />
            ))}
          </div>

          <svg viewBox="0 0 620 330" className="absolute inset-0 h-full w-full">
            <motion.g initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.85, duration: 0.7 }} style={{ transformOrigin: '310px 182px' }}>
              <polygon points="310,94 365,160 334,238 252,238 222,160" fill="#A78BFA" stroke="#4C1D95" strokeWidth="4" />
              <polygon points="310,94 334,238 310,278 286,238" fill="#7C3AED" opacity=".58" />
              <motion.polygon points="310,94 365,160 334,238 252,238 222,160" fill="none" stroke="#E0E7FF" strokeWidth="7" animate={{ opacity: [0.15, 0.8, 0.15] }} transition={{ duration: 1.8, repeat: Infinity }} />
            </motion.g>
            <DrawArrow d="M310 176 C235 126 180 94 132 84" delay={1.15} color="#6366F1" />
            <DrawArrow d="M332 156 C412 108 462 74 520 66" delay={1.35} color="#14B8A6" />
            <DrawArrow d="M282 206 C220 250 168 268 112 276" delay={1.55} color="#F59E0B" />
            <DrawArrow d="M346 210 C426 246 480 262 536 270" delay={1.75} color="#F97373" />
          </svg>

          {nodes.map(([label, pos], index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.76 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2 + index * 0.18, duration: 0.45 }}
              className={`absolute ${pos} rounded-2xl border border-white/75 bg-white/80 px-3 py-2 text-xs font-bold text-slate-800 shadow-xl shadow-indigo/10 backdrop-blur-xl`}
            >
              {label}
            </motion.div>
          ))}
        </div>
        <div className="grid content-start gap-3">
          <StepCard index={0} title="Earth layers" text="Minerals are found naturally in rocks and underground layers." />
          <StepCard index={1} title="Crystal formation" text="Atoms arrange into repeating patterns, forming crystals." />
          <StepCard index={2} title="Use examples" text="Iron, copper, salt, limestone, coal, gas, and petroleum are common examples." />
        </div>
      </div>
    </TeachingShell>
  )
}
