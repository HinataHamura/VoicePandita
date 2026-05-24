'use client'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation'

const MODES: { val: OutputMode; label: string }[] = [
  { val: 'whiteboard', label: 'Whiteboard' },
  { val: 'animation', label: 'Animation' },
  { val: 'text', label: 'Step-by-step' },
  { val: 'exam', label: 'Exam style' },
  { val: 'simple', label: 'Simple mode' },
]

interface Props { value: OutputMode; onChange: (v: OutputMode) => void }

export default function OutputModeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {MODES.map(mode => (
        <button
          key={mode.val}
          onClick={() => onChange(mode.val)}
          className={`bangla flex-shrink-0 rounded-full border px-4 py-2 text-xs shadow-sm ${
            value === mode.val
              ? 'border-forest bg-gradient-to-r from-forest to-indigo text-white font-medium shadow-forest/20'
              : 'border-white/60 bg-white/66 text-ink/55 backdrop-blur-xl hover:border-forest/24 hover:bg-white hover:text-ink/75'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
