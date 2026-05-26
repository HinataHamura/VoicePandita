'use client'

import { useEffect, useState } from 'react'

export interface PWNHotspot {
  id?: string
  topic: string
  subject: string
  count: number
  clarification: string
  samples?: string[]
  topKeywords?: string[]
  emotionPattern?: string
  lastAskedAt?: string
}

export interface PWNStats {
  totalAsks: number
  trendingCount: number
  topSubject: string
}

export function usePWNInsights(subject = 'all') {
  const [hotspots, setHotspots] = useState<PWNHotspot[]>([])
  const [stats, setStats] = useState<PWNStats>({ totalAsks: 0, trendingCount: 0, topSubject: 'all' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    const query = subject === 'all' ? '' : `?subject=${encodeURIComponent(subject)}`
    fetch(`/api/pwn${query}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setHotspots(Array.isArray(data.hotspots) ? data.hotspots : [])
        setStats(data.stats || { totalAsks: 0, trendingCount: 0, topSubject: 'all' })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHotspots([])
          setStats({ totalAsks: 0, trendingCount: 0, topSubject: 'all' })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [subject])

  return { hotspots, stats, loading }
}
