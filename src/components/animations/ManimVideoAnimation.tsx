'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Film, PlayCircle } from 'lucide-react'
import type { AnimationKey } from './types'

interface ManimAsset {
  key: AnimationKey
  title: string
  concept: string
  src: string
  poster?: string
  durationSeconds?: number
  available: boolean
  generatedAt?: string
}

interface ManimManifest {
  version: number
  assets: ManimAsset[]
}

interface Props {
  animationKey: AnimationKey
  fallback?: ReactNode
}

const MANIFEST_URL = '/animations/manim/manifest.json'

export default function ManimVideoAnimation({ animationKey, fallback }: Props) {
  const [asset, setAsset] = useState<ManimAsset | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadManifest() {
      setReady(false)
      setFailed(false)
      setAsset(null)

      try {
        const response = await fetch(MANIFEST_URL, { cache: 'no-store' })
        if (!response.ok) throw new Error(`Manim manifest unavailable: ${response.status}`)
        const manifest = (await response.json()) as ManimManifest
        const nextAsset = manifest.assets.find(item => item.key === animationKey && item.available)
        if (!cancelled) setAsset(nextAsset || null)
      } catch {
        if (!cancelled) setAsset(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    loadManifest()
    return () => {
      cancelled = true
    }
  }, [animationKey])

  if (!ready) {
    return (
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-paper/70">
        <div className="flex aspect-video items-center justify-center gap-2 text-sm text-ink/55">
          <Film size={16} className="text-forest" />
          Loading visual...
        </div>
      </div>
    )
  }

  if (!asset || failed) {
    if (fallback) return <>{fallback}</>
    return (
      <div className="rounded-2xl border border-forest/10 bg-paper/70 px-4 py-5 text-sm text-ink/55">
        No pre-rendered Manim video is available for this concept yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-forest/10 bg-slate-950 shadow-sm">
      <div className="relative">
        <video
          className="aspect-video w-full bg-slate-950 object-contain"
          controls
          preload="metadata"
          playsInline
          poster={asset.poster}
          onError={() => setFailed(true)}
        >
          <source src={asset.src} type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <PlayCircle size={13} />
          Manim explainer
        </div>
      </div>
      <div className="bg-white px-3 py-2">
        <div className="text-sm font-semibold text-ink">{asset.title}</div>
        <div className="text-xs text-ink/50">{asset.concept}</div>
      </div>
    </div>
  )
}
