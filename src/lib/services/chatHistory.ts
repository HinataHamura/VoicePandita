'use client'

import { createClient } from '@/lib/supabase/client'
import {
  clearChatHistory,
  getChatHistory,
  recordChatHistory,
  type ChatHistoryItem,
} from '@/lib/studentStore'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatSessionSummary {
  id: string
  user_id: string
  title: string
  subject?: string | null
  output_mode?: string | null
  created_at: string
  updated_at: string
  last_message?: string | null
  message_count?: number
}

export interface ChatMessageRow {
  id: string
  session_id: string
  role: ChatRole
  content: string
  emotion?: string | null
  diagram?: string | null
  graph_path?: string[] | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AppendMessageInput {
  role: ChatRole
  content: string
  emotion?: string | null
  diagram?: string | null
  graphPath?: string[]
  metadata?: Record<string, unknown>
}

const PENDING_SYNC_KEY = 'pending_sync_queue'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function titleFromQuestion(question: string) {
  const clean = question.replace(/\s+/g, ' ').trim()
  return clean.length > 56 ? `${clean.slice(0, 56)}...` : clean || 'New learning chat'
}

async function currentUserId() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

export async function createChatSession(params: {
  firstQuestion: string
  subject: string
  outputMode: string
}) {
  const userId = await currentUserId()
  if (!userId) return null

  const supabase = createClient()
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      title: titleFromQuestion(params.firstQuestion),
      subject: params.subject,
      output_mode: params.outputMode,
    })
    .select('id,user_id,title,subject,output_mode,created_at,updated_at')
    .single()

  if (error) {
    console.warn('[chatHistory] createChatSession failed:', error.message)
    return null
  }

  return data as ChatSessionSummary
}

export async function appendChatMessages(sessionId: string | null, messages: AppendMessageInput[]) {
  if (!sessionId || messages.length === 0) return false
  const userId = await currentUserId()
  if (!userId) return false

  const supabase = createClient()
  const rows = messages.map(message => ({
    session_id: sessionId,
    role: message.role,
    content: message.content,
    emotion: message.emotion || null,
    diagram: message.diagram || null,
    graph_path: message.graphPath || null,
    metadata: message.metadata || {},
  }))

  const { error } = await supabase.from('chat_messages').insert(rows)
  if (error) {
    console.warn('[chatHistory] appendChatMessages failed:', error.message)
    return false
  }

  const last = messages[messages.length - 1]
  await supabase
    .from('chat_sessions')
    .update({
      updated_at: new Date().toISOString(),
      last_message: last.content.slice(0, 220),
    })
    .eq('id', sessionId)
    .eq('user_id', userId)

  return true
}

export async function fetchChatSessions(limit = 40, offset = 0) {
  const userId = await currentUserId()
  if (!userId) return { sessions: [] as ChatSessionSummary[], source: 'guest' as const }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id,user_id,title,subject,output_mode,created_at,updated_at,last_message,message_count')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.warn('[chatHistory] fetchChatSessions failed:', error.message)
    return { sessions: [] as ChatSessionSummary[], source: 'error' as const }
  }

  return { sessions: (data || []) as ChatSessionSummary[], source: 'supabase' as const }
}

export async function fetchChatMessages(sessionId: string) {
  const userId = await currentUserId()
  if (!userId) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id,session_id,role,content,emotion,diagram,graph_path,metadata,created_at,chat_sessions!inner(user_id)')
    .eq('session_id', sessionId)
    .eq('chat_sessions.user_id', userId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    console.warn('[chatHistory] fetchChatMessages failed:', error.message)
    return []
  }

  return (data || []).map(({ chat_sessions: _ignored, ...message }: any) => message) as ChatMessageRow[]
}

export async function renameChatSession(sessionId: string, title: string) {
  const userId = await currentUserId()
  if (!userId || !title.trim()) return false
  const supabase = createClient()
  const { error } = await supabase
    .from('chat_sessions')
    .update({ title: title.trim().slice(0, 90), updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId)
  return !error
}

export async function deleteChatSession(sessionId: string) {
  const userId = await currentUserId()
  if (!userId) return false
  const supabase = createClient()
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId)
  return !error
}

export function recordOfflineChat(item: Omit<ChatHistoryItem, 'id' | 'createdAt'>) {
  recordChatHistory(item)
}

export function queuePendingHistorySync(item: Omit<ChatHistoryItem, 'id' | 'createdAt'>) {
  if (!canUseStorage()) return
  const existing = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]') as Array<Omit<ChatHistoryItem, 'id' | 'createdAt'> & { queuedAt: string }>
  existing.push({ ...item, queuedAt: new Date().toISOString() })
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(existing.slice(-50)))
}

export async function flushPendingHistorySync() {
  if (!canUseStorage() || !navigator.onLine) return false
  const pending = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]') as Array<Omit<ChatHistoryItem, 'id' | 'createdAt'> & { queuedAt?: string }>
  if (!pending.length) return true
  const userId = await currentUserId()
  if (!userId) return false

  const remaining: typeof pending = []
  for (const item of pending) {
    const session = await createChatSession({
      firstQuestion: item.question,
      subject: item.subject,
      outputMode: item.outputMode,
    })
    if (!session) {
      remaining.push(item)
      continue
    }
    const ok = await appendChatMessages(session.id, [
      { role: 'user', content: item.question, metadata: { offlineQueued: true, queuedAt: item.queuedAt } },
      {
        role: 'assistant',
        content: item.answer,
        graphPath: item.graphPath,
        metadata: {
          offlineQueued: true,
          source: item.source,
          language: item.language,
          outputMode: item.outputMode,
          subject: item.subject,
        },
      },
    ])
    if (!ok) remaining.push(item)
  }

  if (remaining.length) localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining))
  else localStorage.removeItem(PENDING_SYNC_KEY)
  return remaining.length === 0
}

export async function migrateLocalHistoryToSupabase() {
  if (!canUseStorage() || localStorage.getItem('vp_history_migrated') === '1') return
  const userId = await currentUserId()
  if (!userId) return
  const local = getChatHistory()
  if (!local.length) {
    localStorage.setItem('vp_history_migrated', '1')
    return
  }

  for (const item of local.slice().reverse()) {
    const session = await createChatSession({
      firstQuestion: item.question,
      subject: item.subject,
      outputMode: item.outputMode,
    })
    if (!session) continue
    await appendChatMessages(session.id, [
      { role: 'user', content: item.question, metadata: { migrated: true } },
      {
        role: 'assistant',
        content: item.answer,
        diagram: null,
        graphPath: item.graphPath,
        metadata: {
          migrated: true,
          source: item.source,
          language: item.language,
          outputMode: item.outputMode,
          subject: item.subject,
        },
      },
    ])
  }

  localStorage.setItem('vp_history_migrated', '1')
  clearChatHistory()
}
