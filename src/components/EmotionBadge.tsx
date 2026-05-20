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
    <span className={`${c.cls} rounded-full px-2.5 py-0.5 font-medium bangla ${small ? 'text-xs' : 'text-xs'}`}>
      {c.label}
    </span>
  )
}
