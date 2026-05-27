'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  deleteChatSession,
  fetchChatSessions,
  migrateLocalHistoryToSupabase,
  renameChatSession,
  type ChatSessionSummary,
} from '@/lib/services/chatHistory'
import { getChatHistory } from '@/lib/studentStore'

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'supabase' | 'guest' | 'error'>('guest')

  const refresh = useCallback(async () => {
    setLoading(true)
    await migrateLocalHistoryToSupabase()
    const result = await fetchChatSessions()
    if (result.source === 'guest' || result.source === 'error') {
      const localSessions: ChatSessionSummary[] = getChatHistory().map(item => ({
        id: item.id,
        user_id: 'guest',
        title: item.question,
        subject: item.subject,
        output_mode: item.outputMode,
        last_message: item.answer,
        message_count: 2,
        created_at: item.createdAt,
        updated_at: item.createdAt,
      }))
      setSessions(localSessions)
    } else {
      setSessions(result.sessions)
    }
    setSource(result.source)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const rename = useCallback(async (id: string, title: string) => {
    const ok = await renameChatSession(id, title)
    if (ok) setSessions(prev => prev.map(item => item.id === id ? { ...item, title } : item))
    return ok
  }, [])

  const remove = useCallback(async (id: string) => {
    const ok = await deleteChatSession(id)
    if (ok) setSessions(prev => prev.filter(item => item.id !== id))
    return ok
  }, [])

  return { sessions, loading, source, refresh, rename, remove }
}
