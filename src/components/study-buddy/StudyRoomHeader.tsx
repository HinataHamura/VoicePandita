import Link from 'next/link'
import { ArrowLeft, Clock, Users } from 'lucide-react'

export default function StudyRoomHeader({ topicTitle, status, memberCount }: { topicTitle: string; status: string; memberCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-cream/95 px-4 py-3 shadow-sm backdrop-blur-2xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/learn" className="rounded-xl border border-white/60 bg-white/75 p-2" aria-label="Back to learn">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold">Bondhu Study Room</h1>
            <p className="truncate text-xs text-ink/50">{topicTitle}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 text-xs font-semibold text-ink/55">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-3 py-1.5"><Clock size={12} /> {status}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-3 py-1.5"><Users size={12} /> {memberCount}</span>
        </div>
      </div>
    </header>
  )
}
