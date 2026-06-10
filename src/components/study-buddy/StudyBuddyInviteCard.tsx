'use client'

import { Loader2, Users } from 'lucide-react'
import { useStudyBuddyJoin } from '@/hooks/useStudyBuddyJoin'

export default function StudyBuddyInviteCard(props: {
  questionText: string
  subject?: string
  language?: 'bn' | 'en' | 'chakma' | 'marma' | 'garo'
  emotionLabel?: 'confident' | 'confused' | 'frustrated'
  conceptHint?: string
  anonymousSessionId?: string
}) {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_STUDY_BUDDY === 'true'
  const { join, loading, error } = useStudyBuddyJoin()
  if (!enabled) return null

  return (
    <div className="rounded-2xl border border-indigo/15 bg-indigo/10 p-4 shadow-sm shadow-forest/5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-forest to-indigo text-white">
          <Users size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-ink">Bondhu Study Room</h3>
          <p className="bangla mt-1 text-sm leading-6 text-ink/65">
            এই topic নিয়ে ১০ মিনিট group practice করবে? AI host ভালো question দেবে, আর student রা moderated chat-এ আলোচনা করতে পারবে।
          </p>
          {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button
            type="button"
            onClick={() => join(props)}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            Bondhu Study Room Join
          </button>
        </div>
      </div>
    </div>
  )
}
