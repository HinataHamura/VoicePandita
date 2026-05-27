'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, BarChart3, BookOpen, Flame, MessageCircleQuestion, Network, Users } from 'lucide-react'
import { usePWNInsights } from '@/hooks/usePWNInsights'

const subjectColor: Record<string, string> = {
  physics: 'bg-blue-50 text-blue-700',
  chemistry: 'bg-purple-50 text-purple-700',
  biology: 'bg-green-50 text-green-700',
  geography: 'bg-cyan-50 text-cyan-700',
  math: 'bg-orange-50 text-orange-700',
  unknown: 'bg-slate-50 text-slate-600',
}

export default function PwnPage() {
  const [filter, setFilter] = useState('all')
  const { hotspots, stats, loading } = usePWNInsights(filter)

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link href="/learn" className="rounded-2xl border border-white/60 bg-white/72 p-2 shadow-sm shadow-forest/5 hover:scale-105 hover:bg-white" aria-label="Back to learn">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display text-lg font-bold flex items-center gap-2">
              <Users size={18} className="text-forest" /> Peer Wisdom Network
            </h1>
            <p className="text-xs text-ink/45">Anonymized community learning intelligence from real questions</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { label: 'Total community asks', value: stats.totalAsks, icon: BarChart3 },
            { label: 'Trending confusions', value: stats.trendingCount, icon: Flame },
            { label: 'Top subject', value: stats.topSubject, icon: Network },
          ].map((item, index) => (
            <motion.article key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">{item.label}</p>
                  <div className="mt-2 text-2xl font-black capitalize text-slate-950">{item.value}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-forest/12 to-aqua/25 text-forest">
                  <item.icon size={19} />
                </div>
              </div>
            </motion.article>
          ))}
        </section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <p className="text-sm leading-relaxed text-ink/70">
            VoicePandita groups anonymous questions into shared confusion patterns. When many students ask the same concept, it becomes a hotspot and future explanations can become clearer for everyone.
          </p>
        </motion.section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'physics', 'chemistry', 'biology', 'geography', 'math'].map(item => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs capitalize transition-all ${
                filter === item
                  ? 'border-forest bg-forest/10 font-medium text-forest'
                  : 'border-white/60 bg-white/70 text-ink/50 hover:border-forest/20 hover:bg-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map(item => <div key={item} className="skeleton h-40 rounded-2xl" />)}
          </div>
        ) : hotspots.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest/10 text-forest">
              <MessageCircleQuestion size={22} />
            </div>
            <h2 className="font-display text-xl font-bold">No community hotspot yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink/55">As students ask questions, anonymized concept patterns will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {hotspots.map((hotspot, index) => (
              <motion.article key={`${hotspot.subject}-${hotspot.topic}-${index}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="card p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${subjectColor[hotspot.subject] || subjectColor.unknown}`}>
                        {hotspot.subject}
                      </span>
                      <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-xs font-semibold text-orange-600">
                        {hotspot.emotionPattern || 'mixed'}
                      </span>
                    </div>
                    <h2 className="bangla truncate font-semibold text-slate-950">{hotspot.topic}</h2>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-forest/10 px-3 py-1 text-forest">
                    <Flame size={14} />
                    <span className="text-xs font-bold">{hotspot.count}</span>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl bg-paper/70 p-3">
                  <p className="text-sm font-semibold text-ink">
                    {hotspot.count} students were confused about this concept.
                  </p>
                  <p className="text-sm leading-relaxed text-ink/65">{hotspot.clarification}</p>
                  {hotspot.topKeywords?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {hotspot.topKeywords.slice(0, 5).map(keyword => (
                        <span key={keyword} className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-ink/55">{keyword}</span>
                      ))}
                    </div>
                  ) : null}
                  {hotspot.samples?.length ? (
                    <div className="space-y-1.5">
                      {hotspot.samples.slice(0, 2).map((sample, sampleIndex) => (
                        <div key={`${hotspot.topic}-${sampleIndex}`} className="flex gap-2 text-xs text-ink/55">
                          <MessageCircleQuestion size={13} className="mt-0.5 flex-shrink-0 text-forest" />
                          <span className="line-clamp-2">{sample}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <Link href={`/learn?q=${encodeURIComponent(hotspot.topic)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
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
