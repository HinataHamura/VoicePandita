import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudyBuddyLanguage } from './types'

export async function findMatchingRoom(params: {
  supabase: SupabaseClient
  topicKey: string
  language: StudyBuddyLanguage
  classLevel?: string
  maxMembers: number
}) {
  let query = params.supabase
    .from('study_rooms')
    .select('id, topic_key, topic_title, room_status, min_members, max_members, expires_at, study_room_members(id)')
    .eq('topic_key', params.topicKey)
    .eq('language', params.language)
    .eq('room_status', 'waiting')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(8)

  if (params.classLevel) query = query.eq('class_level', params.classLevel)
  const { data, error } = await query
  if (error) throw error

  return (data || []).find((room: any) => (room.study_room_members?.length || 0) < params.maxMembers) || null
}
