'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Flame, MessageCircleQuestion, Users } from 'lucide-react'

interface Hotspot {
  topic: string
  subject: string
  count: number
  clarification: string
  samples?: string[]
}

const subjectColor: Record<string, string> = {
  physics: 'bg-blue-50 text-blue-700',
  chemistry: 'bg-purple-50 text-purple-700',
  biology: 'bg-green-50 text-green-700',
  math: 'bg-orange-50 text-orange-700',
}

export default function PwnPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch('/api/pwn')
      .then(res => res.json())
      .then(data => setHotspots(Array.isArray(data.hotspots) ? data.hotspots : []))
      .catch(() => setHotspots([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? hotspots : hotspots.filter(item => item.subject === filter)

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-10 bg-cream/85 backdrop-blur-sm border-b border-black/5 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/learn" className="p-2 hover:bg-black/5 rounded-lg" aria-label="Back to learn">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg flex items-center gap-2">
              <Users size={18} className="text-saffron" /> Peer Wisdom Network
            </h1>
            <p className="text-xs text-ink/45">Common confusion hotspots from anonymous student questions</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5 bg-forest/5 border-forest/10">
          <p className="text-sm text-ink/70 leading-relaxed">
            Same concept niye koto bar question hocche seta ekhane dekha jay. Example: Ionic Bond niye 10 ta question hole eta hotspot hisebe upore ashbe.
          </p>
        </motion.section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'physics', 'chemistry', 'biology', 'math'].map(item => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all capitalize ${
                filter === item
                  ? 'bg-saffron/10 border-saffron/30 text-saffron font-medium'
                  : 'bg-white border-black/8 text-ink/50 hover:border-saffron/20'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(item => <div key={item} className="skeleton h-28 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink/55">No hotspots found for this filter.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((hotspot, index) => (
              <motion.article key={`${hotspot.subject}-${hotspot.topic}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${subjectColor[hotspot.subject] || 'bg-gray-50 text-gray-600'}`}>
                      {hotspot.subject}
                    </span>
                    <h2 className="font-semibold truncate">{hotspot.topic}</h2>
                  </div>
                  <div className="flex items-center gap-1 text-saffron flex-shrink-0">
                    <Flame size={14} />
                    <span className="text-xs font-bold">{hotspot.count}x</span>
                  </div>
                </div>
                <div className="bg-paper rounded-lg p-3 space-y-3">
                  <p className="text-sm font-medium text-ink">
                    {hotspot.topic} niye {hotspot.count} bar question kora hoyeche.
                  </p>
                  <p className="text-sm text-ink/65 leading-relaxed">{hotspot.clarification}</p>
                  {hotspot.samples?.length ? (
                    <div className="space-y-1.5">
                      {hotspot.samples.slice(0, 3).map((sample, sampleIndex) => (
                        <div key={`${hotspot.topic}-${sampleIndex}`} className="flex gap-2 text-xs text-ink/55">
                          <MessageCircleQuestion size={13} className="mt-0.5 flex-shrink-0 text-saffron" />
                          <span className="line-clamp-2">{sample}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Link href={`/learn?q=${encodeURIComponent(hotspot.topic)}`} className="mt-3 inline-flex items-center gap-1 text-xs text-saffron font-medium hover:underline">
                  <BookOpen size={12} /> Study this concept
                </Link>
              </motion.article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
