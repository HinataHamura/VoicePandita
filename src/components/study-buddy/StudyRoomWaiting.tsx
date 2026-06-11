import { Loader2, Users } from 'lucide-react'
import StudyRoomPresence from './StudyRoomPresence'
import type { StudyRoomMember } from '@/lib/study-buddy/types'

export default function StudyRoomWaiting(props: {
  topicTitle: string
  members: StudyRoomMember[]
  minMembers: number
  waitExpired: boolean
  onSolo: () => void
}) {
  const needed = Math.max(0, props.minMembers - props.members.length)
  return (
    <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/60 bg-white/82 p-6 text-center shadow-2xl shadow-forest/10 backdrop-blur-xl">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/25">
        <Users size={24} />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">Bondhu Study Room</h1>
      <p className="mt-2 text-sm text-ink/55">{props.topicTitle}</p>
      <div className="my-5 inline-flex items-center gap-2 rounded-full bg-forest/10 px-4 py-2 text-sm font-semibold text-forest">
        <Loader2 size={15} className="animate-spin" />
        আরও {needed} জন student আসলে room শুরু হবে
      </div>
      <StudyRoomPresence members={props.members} />
      {props.waitExpired && (
        <button type="button" onClick={props.onSolo} className="mt-6 rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white shadow-sm">
          Solo AI practice শুরু করো
        </button>
      )}
      <p className="bangla mt-5 text-xs leading-5 text-ink/45">Fake human student দেখানো হয় না। Personal info share করো না।</p>
    </section>
  )
}
