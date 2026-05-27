'use client'

type EmotionState = 'confident' | 'confused' | 'frustrated' | null

interface Props { emotion: EmotionState; small?: boolean }

const cfg: Record<string, { label: string; cls: string }> = {
  confident: { label: 'Confident', cls: 'badge-confident' },
  confused: { label: 'Confused', cls: 'badge-confused' },
  frustrated: { label: 'Frustrated', cls: 'badge-frustrated' },
}

export default function EmotionBadge({ emotion, small }: Props) {
  if (!emotion) return null
  const c = cfg[emotion]
  if (!c) return null
  return (
    <span className={`${c.cls} rounded-full px-3 py-1 font-semibold shadow-sm bangla ${small ? 'text-xs' : 'text-xs'}`}>
      {c.label}
    </span>
  )
}
