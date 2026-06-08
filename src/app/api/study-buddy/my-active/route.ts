import { NextResponse } from 'next/server'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled } from '@/lib/study-buddy/server'

export async function GET() {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ room: null })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ room: null })

  const sessionId = getOrCreateAnonymousSessionId()
  const { data, error } = await supabase
    .from('study_room_members')
    .select('room_id, study_rooms(id, topic_title, room_status, expires_at)')
    .eq('anonymous_session_id', sessionId)
    .eq('member_status', 'active')
    .in('study_rooms.room_status', ['waiting', 'active'])
    .order('joined_at', { ascending: false })
    .limit(1)

  if (error) return NextResponse.json({ room: null })
  return NextResponse.json({ room: (data?.[0] as any)?.study_rooms || null })
}
