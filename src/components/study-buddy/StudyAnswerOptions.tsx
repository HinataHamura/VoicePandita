import type { StudyRoomQuestion } from '@/lib/study-buddy/types'

export default function StudyAnswerOptions(props: {
  question: StudyRoomQuestion
  selected?: string
  disabled?: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {props.question.options.map(option => {
        const active = props.selected === option.id
        return (
          <button
            key={option.id}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onSelect(option.id)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
              active
                ? 'border-forest bg-forest text-white shadow-lg shadow-forest/20'
                : 'border-white/60 bg-white/75 text-ink hover:border-forest/25 hover:bg-white'
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <span className="mr-2 font-bold">{option.id}.</span>
            <span className="bangla">{option.text}</span>
          </button>
        )
      })}
    </div>
  )
}
