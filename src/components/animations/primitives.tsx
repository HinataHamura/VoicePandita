'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export const reveal = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.16, duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  }),
}

export function TeachingShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[1.25rem] border border-white/70 bg-white/70 p-4 shadow-2xl shadow-indigo/10 backdrop-blur-2xl md:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,.13),transparent_34%),linear-gradient(230deg,rgba(20,184,166,.14),transparent_42%),linear-gradient(20deg,rgba(251,146,60,.10),transparent_58%)]" />
      <div className="relative z-10">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest/70">Live visual teaching</div>
            <h3 className="bangla mt-1 font-display text-xl font-bold text-slate-950">{title}</h3>
            <p className="bangla mt-1 max-w-2xl text-xs leading-relaxed text-ink/55">{subtitle}</p>
          </div>
          <motion.div
            animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.04, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700"
          >
            AI teacher animating
          </motion.div>
        </div>
        {children}
      </div>
    </motion.section>
  )
}

export function StepCard({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="show"
      variants={reveal}
      className="rounded-2xl border border-white/70 bg-white/74 p-3 shadow-lg shadow-indigo/5 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold text-white">{index + 1}</span>
        <div className="bangla text-sm font-semibold text-slate-900">{title}</div>
      </div>
      <p className="bangla mt-2 text-xs leading-relaxed text-ink/58">{text}</p>
    </motion.div>
  )
}

export function DrawArrow({ d, color = '#6366F1', delay = 0 }: { d: string; color?: string; delay?: number }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay, duration: 0.9, ease: 'easeInOut' }}
    />
  )
}

export function Particle({
  className,
  delay = 0,
  children,
}: {
  className?: string
  delay?: number
  children?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0.8], scale: [0.6, 1, 1.04, 1], y: [10, 0, -8, 0] }}
      transition={{ delay, duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
