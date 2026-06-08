import { useCallback, useEffect, useState } from 'react'
import type { StudyRoom, StudyRoomAnswer, StudyRoomMember, StudyRoomMessage, StudyRoomQuestion } from '@/lib/study-buddy/types'

interface StudyRoomPayload {
  room: StudyRoom
  members: StudyRoomMember[]
  questions: StudyRoomQuestion[]
  messages: StudyRoomMessage[]
  answers: StudyRoomAnswer[]
  sessionId: string
}

export function useStudyRoom(roomId: string, demoQuery = '') {
  const [data, setData] = useState<StudyRoomPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(`/api/study-buddy/room/${roomId}${demoQuery}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Room load failed')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Room load failed')
    } finally {
      setLoading(false)
    }
  }, [roomId, demoQuery])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { data, loading, error, refresh }
}
