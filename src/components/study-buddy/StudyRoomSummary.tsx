import { BookOpenCheck } from 'lucide-react'

export default function StudyRoomSummary({
  topicTitle,
  score,
  total,
  weakConcepts = [],
}: {
  topicTitle: string
  score?: number
  total?: number
  weakConcepts?: string[]
}) {
  const percent = total ? Math.round(((score || 0) / total) * 100) : 0

  return (
    <section className="rounded-[2rem] border border-forest/15 bg-white/82 p-6 shadow-xl shadow-forest/10">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/10 text-forest">
        <BookOpenCheck size={22} />
      </div>
      <h2 className="bangla font-display text-2xl font-bold text-ink">আজকে তোমরা যা শিখলে</h2>
      <p className="bangla mt-3 leading-7 text-ink/65">
        {topicTitle} নিয়ে মূল ধারণা, বাস্তব উদাহরণ, সাধারণ ভুল, hint ব্যবহার, আর short concept checks practice হয়েছে।
      </p>

      {typeof score === 'number' && typeof total === 'number' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-forest/10 p-4">
            <div className="font-display text-2xl font-bold text-forest">{score}/{total}</div>
            <div className="text-xs text-ink/50">Correct answers</div>
          </div>
          <div className="rounded-2xl bg-indigo/10 p-4">
            <div className="font-display text-2xl font-bold text-indigo">{percent}%</div>
            <div className="text-xs text-ink/50">Room score</div>
          </div>
          <div className="rounded-2xl bg-saffron/15 p-4">
            <div className="font-display text-2xl font-bold text-orange-700">{Math.max(0, total - score)}</div>
            <div className="text-xs text-ink/50">Revise next</div>
          </div>
        </div>
      )}

      {!!weakConcepts.length && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Focus again</div>
          <div className="flex flex-wrap gap-2">
            {weakConcepts.map((concept, index) => (
              <span key={`${concept}-${index}`} className="rounded-full bg-clay/10 px-3 py-1 text-xs font-medium text-clay">{concept}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <a href="/study-buddy" className="rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white">আরেকটা room join করো</a>
        <a href="/learn" className="rounded-xl border border-forest/20 bg-white px-4 py-2 text-sm font-semibold text-forest">Learn এ ফিরে যাও</a>
      </div>
    </section>
  )
}
