import { CheckCircle2, XCircle } from 'lucide-react'
import type { StudyRoomQuestion } from '@/lib/study-buddy/types'

function formulaFor(question: StudyRoomQuestion) {
  const text = `${question.prompt_bn} ${question.explanation_bn} ${question.concept_tag || ''}`.toLowerCase()
  if (text.includes('newton') || text.includes('force') || text.includes('acceleration') || text.includes('mass')) {
    return {
      title: "Newton's Second Law",
      formula: 'F = m × a',
      parts: [
        { label: 'F', text: 'net force' },
        { label: 'm', text: 'mass' },
        { label: 'a', text: 'acceleration' },
      ],
    }
  }
  if (text.includes('photosynthesis') || text.includes('chlorophyll') || text.includes('glucose')) {
    return {
      title: 'Photosynthesis',
      formula: 'CO₂ + H₂O + light → glucose + O₂',
      parts: [
        { label: 'Input', text: 'CO₂, water, light' },
        { label: 'Leaf', text: 'chlorophyll captures light' },
        { label: 'Output', text: 'glucose and oxygen' },
      ],
    }
  }
  return null
}

export default function StudyExplanationPanel(props: {
  question: StudyRoomQuestion
  selected?: string
  isCorrect?: boolean
  onNext: () => void
  isLast: boolean
}) {
  const visual = formulaFor(props.question)
  const selectedOption = props.question.options.find(option => option.id === props.selected)
  const correctOption = props.question.options.find(option => option.id === props.question.correct_answer.id)

  return (
    <section className={`rounded-2xl border p-4 shadow-sm ${props.isCorrect ? 'border-forest/20 bg-forest/5' : 'border-red-200 bg-red-50/70'}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        {props.isCorrect ? <CheckCircle2 size={18} className="text-forest" /> : <XCircle size={18} className="text-red-600" />}
        <span className={props.isCorrect ? 'text-forest' : 'text-red-700'}>
          {props.isCorrect ? 'Correct' : 'Not quite'}
        </span>
      </div>

      {!props.isCorrect && (
        <div className="mb-3 rounded-xl bg-white/80 px-3 py-2 text-sm text-ink/70">
          <p className="bangla">তুমি দিয়েছো: {selectedOption?.text || props.selected}</p>
          <p className="bangla font-semibold text-forest">সঠিক উত্তর: {correctOption?.id}. {correctOption?.text}</p>
        </div>
      )}

      {visual && (
        <div className="mb-3 rounded-2xl border border-indigo/15 bg-white/85 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo">{visual.title}</p>
          <div className="mt-2 rounded-xl bg-indigo/10 px-3 py-3 text-center font-display text-2xl font-bold text-ink">
            {visual.formula}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {visual.parts.map(part => (
              <div key={part.label} className="rounded-xl bg-paper/70 px-3 py-2 text-center">
                <p className="text-sm font-bold text-forest">{part.label}</p>
                <p className="text-xs text-ink/55">{part.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="bangla text-sm leading-6 text-ink/75">{props.question.explanation_bn}</p>
      <button type="button" onClick={props.onNext} className="mt-3 rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white">
        {props.isLast ? 'Summary দেখো' : 'Next question'}
      </button>
    </section>
  )
}
