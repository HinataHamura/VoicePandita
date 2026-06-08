import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { studyRoomChannelName } from '@/lib/study-buddy/realtime'

export function useStudyRoomRealtime(roomId: string, onEvent: () => void) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!roomId || process.env.NEXT_PUBLIC_ENABLE_STUDY_BUDDY !== 'true') return
    const supabase = createClient()
    const channel = supabase
      .channel(studyRoomChannelName(roomId), { config: { private: true } })
      .on('broadcast', { event: '*' }, onEvent)
      .subscribe((status: string) => setConnected(status === 'SUBSCRIBED'))

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, onEvent])

  return { connected }
}
