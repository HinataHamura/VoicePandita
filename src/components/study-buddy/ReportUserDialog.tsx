import { Flag } from 'lucide-react'

export default function ReportUserDialog({ onReport }: { onReport: () => void }) {
  return (
    <button type="button" onClick={onReport} className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">
      <Flag size={12} />
      Report
    </button>
  )
}
