'use client'

import { FormEvent, useMemo, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import type { StudyRoomMessage } from '@/lib/study-buddy/types'

export default function StudyRoomDiscussion(props: {
  messages: StudyRoomMessage[]
  disabled?: boolean
  error?: string
  roomStatus?: 'waiting' | 'active' | 'completed' | 'cancelled' | 'expired'
  onSend: (content: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const discussion = useMemo(
    () => props.messages.filter(message => message.sender_type === 'student' && message.message_type === 'text').slice(-20),
    [props.messages],
  )

  async function submit(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending || props.disabled) return
    setSending(true)
    try {
      await props.onSend(content)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  const isWaiting = props.roomStatus === 'waiting'

  return (
    <section className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-sm shadow-forest/5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <MessageCircle size={16} className="text-forest" />
        Study discussion
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {discussion.length ? discussion.map(message => (
          <div key={message.id} className="rounded-2xl bg-paper/70 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-forest">Bondhu</p>
            <p className="bangla mt-1 text-sm leading-5 text-ink/75">{message.safe_content || message.content}</p>
          </div>
        )) : (
          <p className="bangla rounded-2xl bg-paper/60 px-3 py-3 text-sm leading-6 text-ink/55">
            Topic নিয়ে আলোচনা শুরু করো। Phone, link, social id, বা abusive কথা block হবে।
          </p>
        )}
      </div>
      {props.error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{props.error}</p>}
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          disabled={props.disabled || sending}
          maxLength={180}
          placeholder="Topic নিয়ে message লিখো..."
          className="min-w-0 flex-1 rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm outline-none focus:border-forest/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={props.disabled || sending || !draft.trim()}
          aria-label="Send study message"
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-forest to-indigo text-white shadow-sm disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  )
}
