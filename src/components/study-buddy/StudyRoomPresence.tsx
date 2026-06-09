import { Users } from 'lucide-react'
import type { StudyRoomMember } from '@/lib/study-buddy/types'

export default function StudyRoomPresence({ members }: { members: StudyRoomMember[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {members.map(member => (
        <span key={member.display_alias} className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/75 px-3 py-1 text-xs font-semibold text-ink/65">
          <Users size={12} className="text-forest" />
          {member.display_alias}
        </span>
      ))}
    </div>
  )
}
