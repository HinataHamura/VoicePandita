'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, Globe, Wifi, WifiOff } from 'lucide-react'

const CHAKMA_EXAMPLES = [
  { chakma: 'পদার্থ কী?',         bangla: 'পদার্থবিজ্ঞান কী?',   answer: 'পদার্থবিজ্ঞান হলো বিজ্ঞানের সেই শাখা যা পদার্থ ও শক্তির মধ্যে সম্পর্ক নিয়ে আলোচনা করে।' },
  { chakma: 'বল কী?',             bangla: 'বল কী?',              answer: 'বল হলো সেই ভৌত রাশি যা কোনো বস্তুর অবস্থার পরিবর্তন করতে পারে। F = ma সূত্রে প্রকাশিত।' },
]

export default function ChakmaPage() {
  const [offline, setOffline]   = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer]     = useState('')
  const [loading, setLoading]   = useState(false)

  async function ask() {
    if (!question.trim()) return
    setLoading(true)
    try {
      // In production: route to EthnicAgent with MELD bridge
      const res  = await fetch('/api/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question, subject: 'physics', outputMode: 'simple', language: 'ckm' }),
      })
      const data = await res.json()
      setAnswer(data.answer)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-10 bg-cream/80 backdrop-blur-sm border-b border-black/5 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/learn" className="p-2 hover:bg-black/5 rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="bangla font-display font-bold text-lg flex items-center gap-2">
                <Globe size={18} className="text-forest" /> Chakma Mode
              </h1>
              <p className="bangla text-xs text-ink/40">চাকমা ভাষায় শেখো</p>
            </div>
          </div>
          <button onClick={() => setOffline(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
              offline ? 'bg-clay/10 border-clay/30 text-clay' : 'border-black/10 text-ink/50'
            }`}>
            {offline ? <WifiOff size={12} /> : <Wifi size={12} />}
            {offline ? 'Offline' : 'Online'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {offline && (
          <div className="offline-banner rounded-xl bangla text-sm">
            ⚡ Offline mode — CHT pre-cached content থেকে উত্তর আসছে
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <p className="bangla text-sm text-ink/60 mb-4">
            এই section-এ Chakma/Marma/Garo ভাষায় প্রশ্ন করতে পারো। MELD dataset-এর মাধ্যমে AI তোমার ভাষা বুঝবে।
          </p>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="চাকমা বা বাংলায় প্রশ্ন করো..."
            className="bangla w-full border border-black/10 rounded-xl p-4 text-sm focus:outline-none focus:border-saffron/40 transition-colors resize-none"
            rows={3}
          />
          <button onClick={ask} disabled={loading || !question.trim()}
            className="mt-3 w-full bg-forest text-white py-3 rounded-xl bangla font-semibold text-sm hover:bg-forest/90 transition-all disabled:opacity-50">
            {loading ? 'উত্তর খোঁজা হচ্ছে…' : 'প্রশ্ন করো'}
          </button>
        </motion.div>

        {answer && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-black/5">
              <span className="bangla text-xs font-medium text-forest">চাকমা ব্রিজ • উত্তর</span>
            </div>
            <p className="bangla leading-relaxed">{answer}</p>
          </motion.div>
        )}

        <div>
          <h3 className="bangla font-semibold text-ink/60 text-sm mb-3">উদাহরণ প্রশ্ন</h3>
          <div className="space-y-2">
            {CHAKMA_EXAMPLES.map(ex => (
              <button key={ex.chakma} onClick={() => setQuestion(ex.chakma)}
                className="w-full card p-4 text-left hover:border-forest/30 transition-colors">
                <div className="bangla font-medium text-sm">{ex.chakma}</div>
                <div className="bangla text-xs text-ink/40 mt-1">{ex.bangla}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
