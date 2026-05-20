'use client'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple'

const MODES: { val: OutputMode; label: string }[] = [
  { val: 'whiteboard', label: 'Whiteboard' },
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
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all bangla ${
            value === mode.val
              ? 'bg-saffron/10 border-saffron/30 text-saffron font-medium'
              : 'bg-white border-black/8 text-ink/55 hover:border-saffron/20 hover:text-ink/70'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
