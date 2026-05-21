'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Database, Globe, Wifi, WifiOff } from 'lucide-react'

const EXAMPLES = [
  { label: 'Chakma script', text: '𑄥𑄨𑄠𑄚𑄴 𑄈𑄬𑄚𑄨𑄇𑄴𑄇𑄬 𑄉𑄧𑄢𑄨 ?' },
  { label: 'Bangla to Chakma', text: 'সালোকসংশ্লেষণ সহজ করে বুঝাও' },
  { label: 'Mixed science', text: 'Newton er second law bujhao' },
]

export default function ChakmaPage() {
  const [offline, setOffline] = useState(false)
  const [language, setLanguage] = useState<'ccp' | 'bn'>('ccp')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [translatedQuestion, setTranslatedQuestion] = useState<string | null>(null)
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
      setTranslatedQuestion(data.translatedQuestion)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-10 border-b border-forest/10 bg-cream/82 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/learn" className="rounded-lg border border-forest/10 bg-white/72 p-2 shadow-sm hover:bg-paper/80">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-lg font-bold flex items-center gap-2">
                <Globe size={18} className="text-forest" /> MELD Language Bridge
              </h1>
              <p className="text-xs text-ink/45">Chakma dataset-backed mother-tongue support</p>
            </div>
          </div>
          <button
            onClick={() => setOffline(v => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
              offline ? 'border-clay/30 bg-clay/10 text-clay' : 'border-forest/10 bg-white/70 text-ink/55'
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
            VoicePandita এখন Chakma Unicode detect করে, Hugging Face-এর BN↔CCP parallel dataset দিয়ে Bangla curriculum context বানায়, তারপর answer Chakma script-এ ফিরিয়ে দেয়।
          </p>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-forest/10 bg-paper/65 px-3 py-2 text-xs text-ink/55">
            <Database size={14} className="text-forest" />
            amlan107/chakma-nmt-base-parallel-dev-set · bn/ccp · dev_val
          </div>
          <div className="mb-3 flex gap-2">
            {[
              ['ccp', 'Chakma'],
              ['bn', 'Bangla'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setLanguage(value as 'ccp' | 'bn')}
                className={`rounded-full border px-3 py-1.5 text-xs ${language === value ? 'border-forest bg-forest text-white' : 'border-forest/10 bg-white/80 text-ink/55'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Chakma script বা Bangla question..."
            className="bangla w-full resize-none rounded-lg border border-forest/10 bg-white/86 p-4 text-sm shadow-sm focus:border-saffron/40 focus:outline-none"
            rows={3}
          />
          <button onClick={ask} disabled={loading || !question.trim()} className="mt-3 w-full rounded-lg bg-forest py-3 text-sm font-semibold text-white shadow-lg shadow-forest/18 hover:bg-forest/90 disabled:opacity-50">
            {loading ? 'Bridge response তৈরি হচ্ছে...' : 'Ask EthnicAgent'}
          </button>
        </motion.section>

        {answer && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="mb-3 border-b border-forest/10 pb-3 text-xs font-medium text-forest">MELD bridge response</div>
            {translatedQuestion && (
              <div className="mb-4 rounded-lg bg-forest/5 p-3 text-xs leading-relaxed text-ink/55">
                Bangla bridge question: {translatedQuestion}
              </div>
            )}
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
