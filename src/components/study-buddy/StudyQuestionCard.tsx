import { CheckCircle2, HelpCircle, Lightbulb, XCircle } from 'lucide-react'
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
  const isCorrect = props.selected === props.question.correct_answer.id
  const correctOption = props.question.options.find(option => option.id === props.question.correct_answer.id)

  return (
    <section className="rounded-3xl border border-white/60 bg-white/82 p-5 shadow-xl shadow-forest/10 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-ink/50">
        <span className="inline-flex items-center gap-1.5 font-semibold text-forest">
          <HelpCircle size={14} />
          Concept check {props.question.question_order}/5
        </span>
        <span>{props.answeredCount}/{props.memberCount} answered</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {props.question.concept_tag && (
          <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">{props.question.concept_tag}</span>
        )}
        <span className="rounded-full bg-indigo/10 px-3 py-1 text-xs font-semibold text-indigo">{props.question.difficulty}</span>
      </div>

      <h2 className="bangla mb-4 text-lg font-bold leading-7 text-ink">{props.question.prompt_bn}</h2>
      <StudyAnswerOptions
        question={props.question}
        selected={props.selected}
        correctId={props.selected ? props.question.correct_answer.id : undefined}
        disabled={props.submitting || Boolean(props.selected)}
        onSelect={props.onSelect}
      />

      {props.selected && (
        <div className={`bangla mt-4 rounded-2xl px-4 py-3 text-sm leading-6 ${
          isCorrect ? 'bg-forest/10 text-forest' : 'bg-clay/10 text-clay'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {isCorrect ? 'ঠিক হয়েছে' : `আরেকটু দেখো${correctOption ? ` - সঠিক উত্তর ${correctOption.id}` : ''}`}
          </div>
          <p className="mt-1 text-ink/70">{props.question.explanation_bn}</p>
        </div>
      )}

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
