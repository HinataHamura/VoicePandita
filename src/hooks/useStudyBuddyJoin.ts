import { useState } from 'react'

export function useStudyBuddyJoin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function join(params: {
    questionText: string
    subject?: string
    classLevel?: string
    language?: 'bn' | 'en' | 'chakma' | 'marma' | 'garo'
    emotionLabel?: 'confident' | 'confused' | 'frustrated'
    conceptHint?: string
    anonymousSessionId?: string
  }) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/study-buddy/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Join failed')
      window.location.href = data.redirectUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed')
    } finally {
      setLoading(false)
    }
  }

  return { join, loading, error }
}
