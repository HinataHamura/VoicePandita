import { GitBranch } from 'lucide-react'

function chainFor(topicTitle: string) {
  const topic = topicTitle.toLowerCase()
  if (topic.includes('newton')) return ['Force', 'Mass', 'Acceleration', "Newton's Second Law", 'Real-life motion']
  if (topic.includes('photosynthesis')) return ['Light', 'Chlorophyll', 'CO₂ + Water', 'Glucose', 'Oxygen']
  return ['Core idea', 'Example', 'Practice', 'Explanation', 'Apply']
}

export default function ConceptDependencyMap({ topicTitle, activeIndex = 0 }: { topicTitle: string; activeIndex?: number }) {
  const chain = chainFor(topicTitle)
  return (
    <section className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-sm shadow-forest/5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <GitBranch size={16} className="text-indigo" />
        Concept map
      </div>
      <div className="space-y-2">
        {chain.map((item, index) => (
          <div key={item} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index <= activeIndex ? 'bg-forest text-white' : 'bg-paper text-ink/45'}`}>
              {index + 1}
            </div>
            <div className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-sm ${index <= activeIndex ? 'bg-forest/10 text-ink' : 'bg-paper/60 text-ink/55'}`}>
              {item}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
