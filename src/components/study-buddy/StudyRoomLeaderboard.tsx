import { Trophy } from 'lucide-react'
import type { StudyRoomAnswer, StudyRoomMember } from '@/lib/study-buddy/types'

export default function StudyRoomLeaderboard({ members, answers }: { members: StudyRoomMember[]; answers: StudyRoomAnswer[] }) {
  const correct = answers.filter(answer => answer.is_correct).length
  const rows = members.map((member, index) => ({
    alias: member.display_alias,
    score: Math.max(2, Math.round(((correct + index + 1) / Math.max(1, members.length + answers.length)) * 12)),
    answered: answers.length ? Math.min(answers.length, index + 1) : 0,
  })).sort((a, b) => b.score - a.score)

  return (
    <section className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-sm shadow-forest/5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <Trophy size={16} className="text-gold" />
        Participation board
      </div>
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.alias} className="flex items-center justify-between rounded-2xl bg-paper/60 px-3 py-2 text-sm">
            <span className="font-semibold">{row.alias}</span>
            <span className="text-xs text-ink/55">{row.answered} answers · {row.score} pts</span>
          </div>
        ))}
      </div>
    </section>
  )
}
