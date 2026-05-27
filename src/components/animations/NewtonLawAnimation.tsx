'use client'

import { motion } from 'framer-motion'
import { DrawArrow, StepCard, TeachingShell } from './primitives'
import type { TeachingAnimationProps } from './types'

export default function NewtonLawAnimation(_: TeachingAnimationProps) {
  return (
    <TeachingShell title="Newton's Second Law" subtitle="Force, mass, and acceleration connect through F = ma. The same push behaves differently when mass changes.">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_.9fr]">
        <div className="relative min-h-[310px] overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-b from-sky-50 via-white to-slate-100 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="absolute left-5 top-5 rounded-2xl border border-indigo-100 bg-white/80 px-5 py-3 text-3xl font-black tracking-normal text-slate-950 shadow-xl shadow-indigo/10"
          >
            F = ma
          </motion.div>

          <svg viewBox="0 0 640 310" className="absolute inset-x-0 bottom-0 h-[285px] w-full">
            <defs>
              <marker id="arrow-newton" markerHeight="10" markerWidth="10" orient="auto" refX="8" refY="5">
                <path d="M0,0 L10,5 L0,10 Z" fill="#F97373" />
              </marker>
            </defs>
            <motion.line x1="20" y1="252" x2="620" y2="252" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />
            <DrawArrow d="M92 150 C150 145 176 145 222 145" color="#F97373" delay={0.35} />
            <motion.path d="M92 150 C150 145 176 145 222 145" fill="none" stroke="#F97373" strokeWidth="5" strokeLinecap="round" markerEnd="url(#arrow-newton)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} />
            <motion.g animate={{ x: [0, 210, 112, 250] }} transition={{ duration: 6.2, repeat: Infinity, ease: [0.37, 0, 0.63, 1], times: [0, 0.38, 0.64, 1] }}>
              <rect x="235" y="156" width="126" height="92" rx="18" fill="#6366F1" />
              <rect x="252" y="172" width="92" height="18" rx="9" fill="rgba(255,255,255,.35)" />
              <circle cx="266" cy="257" r="12" fill="#0F172A" />
              <circle cx="332" cy="257" r="12" fill="#0F172A" />
              <motion.circle cx="392" cy="156" r="18" fill="none" stroke="#22C55E" strokeWidth="4" animate={{ r: [16, 42, 16], opacity: [0.7, 0, 0.7] }} transition={{ duration: 1.6, repeat: Infinity }} />
            </motion.g>
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
              <rect x="430" y="80" width="78" height="46" rx="13" fill="#FDBA74" />
              <text x="469" y="109" textAnchor="middle" fontSize="16" fontWeight="700" fill="#7C2D12">more m</text>
            </motion.g>
          </svg>

          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-slate-600">
            <div className="rounded-full bg-white/75 px-3 py-2">push: force</div>
            <div className="rounded-full bg-white/75 px-3 py-2">motion: acceleration</div>
            <div className="rounded-full bg-white/75 px-3 py-2">heavier: slower</div>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <StepCard index={0} title="Formula appears" text="F = ma means force equals mass times acceleration." />
          <StepCard index={1} title="Force pushes" text="A bigger force gives a stronger change in motion." />
          <StepCard index={2} title="Mass resists" text="If mass increases, the same force creates less acceleration." />
        </div>
      </div>
    </TeachingShell>
  )
}
