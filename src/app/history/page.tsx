'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Clock, Edit3, MessageSquare, Trash2 } from 'lucide-react'
import { useChatHistory } from '@/hooks/useChatHistory'
import PageHeader from '@/components/PageHeader'
import type { ChatSessionSummary } from '@/lib/services/chatHistory'

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat('en', {
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function groupFor(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return 'Older'
}

function groupedSessions(sessions: ChatSessionSummary[]) {
  return sessions.reduce<Record<string, ChatSessionSummary[]>>((groups, session) => {
    const group = groupFor(session.updated_at)
    groups[group] = groups[group] || []
    groups[group].push(session)
    return groups
  }, {})
}

export default function HistoryPage() {
  const { sessions, loading, source, rename, remove } = useChatHistory()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const groups = useMemo(() => groupedSessions(sessions), [sessions])

  async function saveRename(id: string) {
    await rename(id, draftTitle)
    setEditingId(null)
    setDraftTitle('')
  }

  return (
    <div className="ai-shell min-h-dvh">
      <PageHeader
        title="Learning Memory"
        subtitle={source === 'supabase' ? 'Synced across your signed-in devices.' : 'Sign in to sync history across devices.'}
        backHref="/learn"
        backLabel="Back to learn"
      />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(item => <div key={item} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex min-h-[52dvh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-forest/12 to-aqua/25 text-forest">
              <MessageSquare size={24} />
            </div>
            <h2 className="font-display text-xl font-bold">No cloud history yet</h2>
            <p className="mt-2 max-w-sm text-sm text-ink/55">Ask from Learn and VoicePandita will save the conversation to your learning memory.</p>
            <Link href="/learn" className="soft-button mt-5 px-5 py-2.5 text-sm font-semibold">
              Ask a question
            </Link>
          </div>
        ) : (
          <div className="space-y-7">
            {['Today', 'Yesterday', 'Older'].filter(group => groups[group]?.length).map(group => (
              <section key={group}>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">
                  <Clock size={13} />
                  {group}
                </div>
                <div className="grid gap-3">
                  {groups[group].map((session, index) => (
                    <motion.article
                      key={session.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="card group p-4 hover:border-forest/25"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/learn?session=${session.id}`} className="min-w-0 flex-1">
                          {editingId === session.id ? (
                            <input
                              value={draftTitle}
                              onChange={event => setDraftTitle(event.target.value)}
                              onClick={event => event.preventDefault()}
                              onKeyDown={event => {
                                if (event.key === 'Enter') saveRename(session.id)
                                if (event.key === 'Escape') setEditingId(null)
                              }}
                              className="w-full rounded-xl border border-forest/20 bg-white/80 px-3 py-2 text-sm font-semibold focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <h2 className="bangla truncate text-sm font-semibold text-slate-950">{session.title}</h2>
                          )}
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink/55">
                            {session.last_message || 'Open this saved learning session.'}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink/45">
                            <span>{formatTime(session.updated_at)}</span>
                            {session.subject && <span className="rounded-full bg-forest/10 px-2 py-0.5 text-forest">{session.subject}</span>}
                            {session.output_mode && <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-orange-600">{session.output_mode}</span>}
                          </div>
                        </Link>
                        <div className="flex flex-shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingId(session.id)
                              setDraftTitle(session.title)
                            }}
                            className="rounded-full border border-white/70 bg-white/74 p-2 text-ink/55 hover:text-forest"
                            aria-label="Rename session"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => remove(session.id)}
                            className="rounded-full border border-white/70 bg-white/74 p-2 text-ink/45 hover:bg-red-50 hover:text-clay"
                            aria-label="Delete session"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
