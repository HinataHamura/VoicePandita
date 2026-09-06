'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, HelpCircle, Lightbulb, XCircle } from 'lucide-react'
import type { StudyRoomQuestion } from '@/lib/study-buddy/types'
import StudyAnswerOptions from './StudyAnswerOptions'

const MOVE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'মূল ধারণা', color: 'bg-forest/10 text-forest' },
  2: { label: 'বাস্তব উদাহরণ', color: 'bg-indigo/10 text-indigo' },
  3: { label: 'সাধারণ ভুল', color: 'bg-clay/10 text-clay' },
  4: { label: 'কারণ-ফল', color: 'bg-saffron/15 text-orange-700' },
  5: { label: 'বন্ধুকে শেখাও', color: 'bg-aqua/15 text-teal-700' },
}

export default function StudyQuestionCard(props: {
  question: StudyRoomQuestion
  selected?: string
  answeredCount: number
  memberCount: number
  showHint: boolean
  submitting?: boolean
  questionNumber?: number
  totalQuestions?: number
  onHint: () => void
  onSelect: (id: string) => void
}) {
  const isCorrect = props.selected === props.question.correct_answer.id
  const correctOption = props.question.options.find(o => o.id === props.question.correct_answer.id)
  const moveInfo = MOVE_LABELS[props.question.question_order] ?? { label: props.question.concept_tag || 'Concept', color: 'bg-forest/10 text-forest' }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl border border-white/60 bg-white/88 p-5 shadow-xl shadow-forest/8 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {props.questionNumber ? (
            <span className="rounded-full bg-forest px-2.5 py-1 text-xs font-bold text-white">
              {props.totalQuestions ? `প্রশ্ন ${props.questionNumber}/${props.totalQuestions}` : `প্রশ্ন ${props.questionNumber}`}
            </span>
          ) : null}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${moveInfo.color}`}>
            <HelpCircle size={11} />
            {moveInfo.label}
          </span>
          <span className="rounded-full bg-indigo/8 px-2.5 py-1 text-xs font-semibold text-indigo">{props.question.difficulty}</span>
        </div>
        <span className="text-xs font-semibold text-ink/40">
          {props.answeredCount}/{props.memberCount} answered
        </span>
      </div>

      {/* Question */}
      <h2 className="bangla mb-5 text-lg font-bold leading-7 text-ink">{props.question.prompt_bn}</h2>

      {/* Options */}
      <StudyAnswerOptions
        question={props.question}
        selected={props.selected}
        correctId={props.selected ? props.question.correct_answer.id : undefined}
        disabled={props.submitting || Boolean(props.selected)}
        onSelect={props.onSelect}
      />

      {/* Feedback */}
      <AnimatePresence>
        {props.selected && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`bangla mt-4 rounded-2xl px-4 py-3.5 text-sm leading-6 ${
              isCorrect
                ? 'border border-forest/20 bg-gradient-to-br from-forest/10 to-forest/5 text-forest'
                : 'border border-clay/20 bg-gradient-to-br from-clay/10 to-clay/5 text-clay'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {isCorrect
                ? <><CheckCircle2 size={16} /> ঠিক হয়েছে! 🎉</>
                : <><XCircle size={16} /> {correctOption ? `সঠিক উত্তর ছিল ${correctOption.id}: ${correctOption.text.slice(0, 40)}…` : 'ঠিক হয়নি'}</>
              }
            </div>
            {props.question.explanation_bn && (
              <p className="mt-2 text-sm leading-6 text-ink/70">{props.question.explanation_bn}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint */}
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <button
          type="button"
          onClick={props.onHint}
          className="inline-flex items-center gap-1.5 rounded-xl border border-saffron/25 bg-saffron/12 px-3 py-1.5 text-xs font-bold text-orange-700 transition-all hover:bg-saffron/20"
        >
          <Lightbulb size={13} />
          Hint
        </button>
        <AnimatePresence>
          {props.showHint && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="bangla text-sm leading-6 text-ink/60"
            >
              {props.question.hint_bn}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
