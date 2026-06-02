'use client'

import { Bot, FileText, GraduationCap, PenTool, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation'

const MODES: { val: OutputMode; label: string; Icon: LucideIcon }[] = [
  { val: 'whiteboard', label: 'Whiteboard', Icon: PenTool },
  { val: 'text', label: 'Text', Icon: FileText },
  { val: 'exam', label: 'Exam', Icon: GraduationCap },
  { val: 'simple', label: 'Simple', Icon: Sparkles },
  { val: 'animation', label: 'Visual', Icon: Bot },
]

interface Props { value: OutputMode; onChange: (v: OutputMode) => void }

export default function OutputModeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {MODES.map(mode => (
        <button
          key={mode.val}
          onClick={() => onChange(mode.val)}
          className={`bangla inline-flex flex-shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs shadow-sm ${
            value === mode.val
              ? 'border-forest bg-gradient-to-r from-forest to-indigo text-white font-medium shadow-forest/20'
              : 'border-white/60 bg-white/66 text-ink/55 backdrop-blur-xl hover:border-forest/24 hover:bg-white hover:text-ink/75'
          }`}
        >
          <mode.Icon size={13} />
          {mode.label}
        </button>
      ))}
    </div>
  )
}
