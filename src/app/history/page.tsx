'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, MessageSquare, Trash2 } from 'lucide-react'
import { clearChatHistory, getChatHistory, type ChatHistoryItem } from '@/lib/studentStore'

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ChatHistoryItem[]>([])

  useEffect(() => {
    setHistory(getChatHistory())
  }, [])

  function clearAll() {
    clearChatHistory()
    setHistory([])
  }

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0 px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/learn" className="rounded-2xl border border-white/60 bg-white/72 p-2 shadow-sm shadow-forest/5 hover:scale-105 hover:bg-white" aria-label="Back to learn">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-lg font-bold">Chat History</h1>
              <p className="text-xs text-ink/45">This device keeps a separate history for each signed-in student.</p>
            </div>
          </div>
          {history.length > 0 && (
            <button onClick={clearAll} className="inline-flex items-center gap-2 rounded-full border border-clay/20 bg-white/70 px-4 py-2 text-sm font-medium text-clay hover:bg-red-50">
              <Trash2 size={15} />
              Clear
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {history.length === 0 ? (
          <div className="flex min-h-[50dvh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-forest/12 to-aqua/25 text-forest">
              <MessageSquare size={24} />
            </div>
            <h2 className="font-display text-xl font-bold">No saved chats yet</h2>
            <p className="mt-2 max-w-sm text-sm text-ink/55">Ask a question on the Learn page and the answer will appear here.</p>
            <Link href="/learn" className="soft-button mt-5 px-5 py-2.5 text-sm font-semibold">
              Ask a question
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map(item => (
              <article key={item.id} className="card p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink/45">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={13} />
                    {formatTime(item.createdAt)}
                  </span>
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-forest">{item.subject}</span>
                  <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-orange-600">{item.outputMode}</span>
                  {item.source && <span className="rounded-full bg-black/5 px-2 py-0.5">{item.source}</span>}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">Question</div>
                    <p className="bangla rounded-2xl bg-forest/10 px-3 py-2 text-sm leading-relaxed text-ink">{item.question}</p>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">Answer</div>
                    <p className="bangla whitespace-pre-line text-sm leading-relaxed text-ink/78">{item.answer}</p>
                  </div>
                  {item.graphPath?.length ? (
                    <div className="rounded-2xl border border-white/60 bg-white/60 px-3 py-2 text-xs text-forest">
                      {item.graphPath.join(' -> ')}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
