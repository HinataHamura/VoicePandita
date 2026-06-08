import { Sparkles } from 'lucide-react'

export default function AIHostMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-forest/15 bg-white/80 p-4 shadow-sm shadow-forest/5">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-forest">
        <Sparkles size={14} />
        AI Host
      </div>
      <div className="bangla text-sm leading-6 text-ink/75">{children}</div>
    </div>
  )
}
