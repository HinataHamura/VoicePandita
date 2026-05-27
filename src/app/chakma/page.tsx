'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Globe, Wifi, WifiOff } from 'lucide-react'

const EXAMPLES = [
  { label: 'Chakma demo', text: 'Newton er second law bujhao' },
  { label: 'Marma demo', text: 'Photosynthesis সহজ করে বুঝাও' },
  { label: 'Garo demo', text: 'Ionic bond ki bhabe hoy?' },
]

export default function ChakmaPage() {
  const [offline, setOffline] = useState(false)
  const [language, setLanguage] = useState<'ckm' | 'mrm' | 'gnk'>('ckm')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  async function ask() {
    if (!question.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, subject: 'physics', outputMode: 'simple', language }),
      })
      const data = await res.json()
      setAnswer(data.answer)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/learn" className="rounded-2xl border border-white/60 bg-white/72 p-2 shadow-sm shadow-forest/5 hover:scale-105 hover:bg-white">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-lg font-bold flex items-center gap-2">
                <Globe size={18} className="text-forest" /> MELD Language Bridge
              </h1>
              <p className="text-xs text-ink/45">Chakma, Marma, Garo mother-tongue support demo</p>
            </div>
          </div>
          <button
            onClick={() => setOffline(v => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
              offline ? 'border-clay/30 bg-clay/10 text-clay' : 'border-white/60 bg-white/70 text-ink/55'
            }`}
          >
            {offline ? <WifiOff size={12} /> : <Wifi size={12} />}
            {offline ? 'Offline pack' : 'Online'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {offline && (
          <div className="offline-banner rounded-lg text-sm">
            Offline CHT pack active - Physics, Chemistry, Biology cached answers are available.
          </div>
        )}

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <p className="mb-4 text-sm leading-relaxed text-ink/64">
            VoicePandita detects ckm/mrm/gnk, bridges to Bangla curriculum context, then returns culturally adapted explanations with examples like Karnaphuli River and jhum farming.
          </p>
          <div className="mb-3 flex gap-2">
            {[
              ['ckm', 'Chakma'],
              ['mrm', 'Marma'],
              ['gnk', 'Garo'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setLanguage(value as 'ckm' | 'mrm' | 'gnk')}
                className={`rounded-full border px-3 py-1.5 text-xs ${language === value ? 'border-forest bg-gradient-to-r from-forest to-indigo text-white' : 'border-white/60 bg-white/80 text-ink/55'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Mother tongue or Bangla question..."
            className="bangla w-full resize-none rounded-2xl border border-white/70 bg-white/86 p-4 text-sm shadow-sm focus:border-forest/40 focus:outline-none"
            rows={3}
          />
          <button onClick={ask} disabled={loading || !question.trim()} className="soft-button mt-3 w-full py-3 text-sm font-semibold disabled:opacity-50">
            {loading ? 'Bridge response তৈরি হচ্ছে...' : 'Ask EthnicAgent'}
          </button>
        </motion.section>

        {answer && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="mb-3 border-b border-forest/10 pb-3 text-xs font-medium text-forest">MELD bridge response</div>
            <p className="bangla whitespace-pre-line leading-relaxed">{answer}</p>
          </motion.section>
        )}

        <section>
          <h3 className="mb-3 text-sm font-semibold text-ink/60">Demo prompts</h3>
          <div className="space-y-2">
            {EXAMPLES.map(ex => (
              <button key={ex.label} onClick={() => setQuestion(ex.text)} className="card w-full p-4 text-left hover:border-forest/30">
                <div className="text-sm font-medium">{ex.label}</div>
                <div className="mt-1 text-xs text-ink/45">{ex.text}</div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
