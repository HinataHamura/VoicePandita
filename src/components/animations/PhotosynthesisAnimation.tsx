'use client'

import { motion } from 'framer-motion'
import { Particle, StepCard, TeachingShell } from './primitives'
import type { TeachingAnimationProps } from './types'

export default function PhotosynthesisAnimation(_: TeachingAnimationProps) {
  return (
    <TeachingShell title="Photosynthesis" subtitle="A living process: sunlight, water, and carbon dioxide enter the leaf; glucose forms and oxygen leaves.">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_.9fr]">
        <div className="relative min-h-[330px] overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-b from-cyan-50 via-emerald-50 to-white p-4">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} className="absolute right-8 top-7 h-20 w-20 rounded-full bg-amber-300 shadow-[0_0_60px_rgba(251,191,36,.55)]" />
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 80, y: -40 }}
              animate={{ opacity: [0, 1, 0], x: [-10 - i * 34, -210 - i * 18], y: [26 + i * 17, 146 + i * 9] }}
              transition={{ delay: i * 0.24, duration: 2.4, repeat: Infinity, repeatDelay: 1.1 }}
              className="absolute right-16 top-16 h-1.5 w-28 rounded-full bg-amber-300"
            />
          ))}

          <svg viewBox="0 0 620 330" className="absolute inset-0 h-full w-full">
            <motion.path
              d="M308 92 C438 82 530 160 492 246 C438 310 326 268 292 190 C258 260 152 300 96 244 C58 152 174 72 308 92 Z"
              fill="#22C55E"
              fillOpacity=".78"
              stroke="#15803D"
              strokeWidth="4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1 }}
            />
            <path d="M304 102 C312 172 308 236 292 300" fill="none" stroke="#166534" strokeWidth="5" strokeLinecap="round" />
            <motion.circle cx="300" cy="182" r="34" fill="#A7F3D0" animate={{ r: [28, 44, 28], opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
            <motion.text x="300" y="188" textAnchor="middle" fontSize="20" fontWeight="800" fill="#065F46" animate={{ opacity: [0.75, 1, 0.75] }} transition={{ duration: 1.7, repeat: Infinity }}>C6H12O6</motion.text>
          </svg>

          <Particle delay={0.1} className="absolute bottom-16 left-14 rounded-full bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700">H2O</Particle>
          <Particle delay={0.4} className="absolute left-14 top-32 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">CO2</Particle>
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ x: [0, 54 + i * 10, 110 + i * 20], y: [0, -18 - i * 8, -58 - i * 4], opacity: [0, 1, 0] }}
              transition={{ delay: 1.2 + i * 0.35, duration: 2.3, repeat: Infinity }}
              className="absolute left-[58%] top-[44%] rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-bold text-cyan-700"
            >
              O2
            </motion.div>
          ))}
        </div>
        <div className="grid content-start gap-3">
          <StepCard index={0} title="Light arrives" text="Chlorophyll catches sunlight like an energy signal." />
          <StepCard index={1} title="Raw materials enter" text="Water comes from roots and CO2 enters through leaf pores." />
          <StepCard index={2} title="Food forms" text="Glucose stores energy; oxygen is released outside." />
        </div>
      </div>
    </TeachingShell>
  )
}
