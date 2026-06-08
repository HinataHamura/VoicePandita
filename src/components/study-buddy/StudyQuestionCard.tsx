import { HelpCircle, Lightbulb } from 'lucide-react'
import type { StudyRoomQuestion } from '@/lib/study-buddy/types'
import StudyAnswerOptions from './StudyAnswerOptions'

export default function StudyQuestionCard(props: {
  question: StudyRoomQuestion
  selected?: string
  answeredCount: number
  memberCount: number
  showHint: boolean
  submitting?: boolean
  onHint: () => void
  onSelect: (id: string) => void
}) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white/82 p-5 shadow-xl shadow-forest/10 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-ink/50">
        <span className="inline-flex items-center gap-1.5 font-semibold text-forest">
          <HelpCircle size={14} />
          Concept check {props.question.question_order}/5
        </span>
        <span>{props.answeredCount}/{props.memberCount} answered</span>
      </div>
      <h2 className="bangla mb-4 text-lg font-bold leading-7 text-ink">{props.question.prompt_bn}</h2>
      <StudyAnswerOptions question={props.question} selected={props.selected} disabled={props.submitting || Boolean(props.selected)} onSelect={props.onSelect} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={props.onHint} className="inline-flex items-center gap-2 rounded-xl border border-saffron/30 bg-saffron/15 px-3 py-2 text-xs font-semibold text-orange-700">
          <Lightbulb size={14} />
          Hint
        </button>
        {props.showHint && <span className="bangla text-sm text-ink/60">{props.question.hint_bn}</span>}
      </div>
    </section>
  )
}
