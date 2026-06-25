'use client'

import { motion } from 'framer-motion'
import { Bot, PenTool, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation' | 'video'

const MODES: { val: OutputMode; label: string; Icon: LucideIcon; tip: string }[] = [
  { val: 'whiteboard', label: 'Whiteboard', Icon: PenTool, tip: 'Diagram ও ধাপে ধাপে বুঝাই' },
  { val: 'animation', label: 'Visual', Icon: Bot, tip: 'Animated concept দেখাই' },
  { val: 'video', label: 'Video', Icon: Video, tip: 'Manim video play করি' },
]

interface Props { value: OutputMode; onChange: (v: OutputMode) => void }

export default function OutputModeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {MODES.map(mode => (
        <button
          key={mode.val}
          onClick={() => onChange(mode.val)}
          title={mode.tip}
          className={`bangla relative inline-flex flex-shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs shadow-sm transition-colors ${
            value === mode.val
              ? 'border-forest/30 text-white font-medium shadow-forest/20'
              : 'border-white/60 bg-white/66 text-ink/55 backdrop-blur-xl hover:border-forest/24 hover:bg-white hover:text-ink/75'
          }`}
        >
          {value === mode.val && (
            <motion.div
              layoutId="output-mode-pill"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-forest to-indigo"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            <mode.Icon size={13} />
            {mode.label}
          </span>
        </button>
      ))}
    </div>
  )
}
