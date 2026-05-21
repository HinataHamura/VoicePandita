'use client'

const SUBJECTS = [
  { val: 'physics',   label: 'Physics'   },
  { val: 'chemistry', label: 'Chemistry' },
  { val: 'biology',   label: 'Biology'   },
  { val: 'math',      label: 'Math'      },
  { val: 'bangla',    label: 'Bangla'    },
  { val: 'english',   label: 'English'   },
]

interface Props { value: string; onChange: (v: string) => void }

export default function SubjectSelector({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="cursor-pointer rounded-full border border-forest/10 bg-white/86 px-3 py-1.5 text-xs shadow-sm focus:border-saffron/50 focus:outline-none"
    >
      {SUBJECTS.map(s => (
        <option key={s.val} value={s.val}>{s.label}</option>
      ))}
    </select>
  )
}
