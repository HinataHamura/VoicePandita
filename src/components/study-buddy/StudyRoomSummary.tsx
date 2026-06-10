import Link from 'next/link'
import { Award, BookOpenCheck, Flame, Target } from 'lucide-react'
import type { StudyRoomMember, StudyRoomQuestion } from '@/lib/study-buddy/types'

export default function StudyRoomSummary(props: {
  topicTitle: string
  questions?: StudyRoomQuestion[]
  results?: Record<string, boolean>
  members?: StudyRoomMember[]
  streakDays?: number
}) {
  const questions = props.questions || []
  const answered = questions.filter(question => props.results?.[question.id] !== undefined)
  const correct = answered.filter(question => props.results?.[question.id]).length
  const total = questions.length || 5
  const weakQuestion = answered.find(question => props.results?.[question.id] === false)
  const weakConcept = weakQuestion?.concept_tag || (props.topicTitle.toLowerCase().includes('newton') ? 'Force and acceleration' : 'Core concept')
  const hardest = weakQuestion || questions.find(question => question.difficulty === 'medium') || questions[2]
  const bestLearner = props.members?.[0]?.display_alias || 'Bondhu 1'

  return (
    <section className="rounded-[2rem] border border-forest/15 bg-white/82 p-6 shadow-xl shadow-forest/10">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/10 text-forest">
        <BookOpenCheck size={22} />
      </div>
      <h2 className="bangla font-display text-2xl font-bold text-ink">আজকের session summary</h2>
      <p className="bangla mt-2 leading-7 text-ink/65">
        তুমি {props.topicTitle}-এ {correct}/{total} পেয়েছো। Weak area: {weakConcept}।
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-forest/10 p-4">
          <Target size={18} className="mb-2 text-forest" />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Score</p>
          <p className="mt-1 text-2xl font-bold text-ink">{correct}/{total}</p>
        </div>
        <div className="rounded-2xl bg-saffron/15 p-4">
          <Award size={18} className="mb-2 text-orange-600" />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">আজকের সেরা শিক্ষার্থী</p>
          <p className="mt-1 font-bold text-ink">{bestLearner}</p>
        </div>
        <div className="rounded-2xl bg-indigo/10 p-4">
          <Flame size={18} className="mb-2 text-indigo" />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Streak</p>
          <p className="mt-1 font-bold text-ink">{props.streakDays || 1} দিন ধরে Study Buddy</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-indigo/15 bg-white/80 p-4">
        <p className="text-sm font-bold text-indigo">Post-room AI summary</p>
        <p className="bangla mt-2 text-sm leading-6 text-ink/70">
          আজকের session-এ দলের সবচেয়ে কঠিন ছিল {hardest ? `Q${hardest.question_order}: ${hardest.concept_tag || hardest.prompt_bn}` : 'মাঝের concept check'}।
          Next practice-এ এই concept-এর আরেকটা real-life example solve করলে বোঝা আরও পরিষ্কার হবে।
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/learn" className="rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white">
          Learn page-এ ফেরত যাও
        </Link>
        <Link href="/study-buddy" className="rounded-xl border border-forest/20 bg-white px-4 py-2 text-sm font-semibold text-forest">
          আরেকটা room join করো
        </Link>
      </div>
    </section>
  )
}
