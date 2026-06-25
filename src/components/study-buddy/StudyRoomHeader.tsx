import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  waiting: { label: 'অপেক্ষা করছি', dot: 'bg-saffron animate-pulse' },
  active: { label: 'চলছে', dot: 'bg-forest animate-pulse' },
  completed: { label: 'শেষ', dot: 'bg-indigo' },
  cancelled: { label: 'বাতিল', dot: 'bg-clay' },
  expired: { label: 'মেয়াদ শেষ', dot: 'bg-ink/30' },
}

export default function StudyRoomHeader({
  topicTitle,
  status,
  memberCount,
}: {
  topicTitle: string
  status: string
  memberCount: number
}) {
  const s = STATUS_MAP[status] ?? { label: status, dot: 'bg-ink/30' }

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-cream/95 px-4 py-3 shadow-sm backdrop-blur-2xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/study-buddy"
            className="flex-shrink-0 rounded-xl border border-white/60 bg-white/75 p-2 hover:bg-white"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-bold text-ink">Bondhu Study Room</h1>
            <p className="bangla truncate text-xs text-ink/50">{topicTitle}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-xs font-semibold text-ink/60">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-xs font-semibold text-ink/60">
            <Users size={11} />
            {memberCount}
          </span>
        </div>
      </div>
    </header>
  )
}
