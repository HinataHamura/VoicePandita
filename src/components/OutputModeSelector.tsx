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
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {MODES.map(mode => (
        <button
          key={mode.val}
          onClick={() => onChange(mode.val)}
          className={`bangla flex-shrink-0 rounded-full border px-3 py-1.5 text-xs ${
            value === mode.val
              ? 'bg-saffron text-white border-saffron font-medium shadow-sm shadow-saffron/15'
              : 'bg-white/80 border-forest/10 text-ink/55 hover:border-saffron/25 hover:text-ink/75'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
