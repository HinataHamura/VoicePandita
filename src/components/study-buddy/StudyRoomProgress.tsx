export default function StudyRoomProgress({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / Math.max(1, total)) * 100))
  return (
    <div className="h-2 overflow-hidden rounded-full bg-forest/10">
      <div className="h-full rounded-full bg-gradient-to-r from-forest to-indigo transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
