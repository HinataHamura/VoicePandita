'use client'

const SUBJECTS = [
  { val: 'physics',   label: 'Physics'   },
  { val: 'chemistry', label: 'Chemistry' },
  { val: 'biology',   label: 'Biology'   },
  { val: 'math',      label: 'Math'      },
  { val: 'english',   label: 'English'   },
]

interface Props { value: string; onChange: (v: string) => void }

export default function SubjectSelector({ value, onChange }: Props) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs border border-black/10 rounded-full px-3 py-1.5 bg-white focus:outline-none focus:border-saffron/50 transition-colors cursor-pointer">
      {SUBJECTS.map(s => (
        <option key={s.val} value={s.val}>{s.label}</option>
      ))}
    </select>
  )
}
