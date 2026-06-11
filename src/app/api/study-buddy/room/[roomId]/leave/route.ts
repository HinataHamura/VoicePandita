import { NextResponse } from 'next/server'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled } from '@/lib/study-buddy/server'
import { roomIdSchema } from '@/lib/study-buddy/validators'

export async function POST(_: Request, { params }: { params: { roomId: string } }) {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ error: 'Disabled' }, { status: 404 })
  const parsedRoomId = roomIdSchema.safeParse(params.roomId)
  if (!parsedRoomId.success) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: true })
  const sessionId = getOrCreateAnonymousSessionId()
  await supabase.from('study_room_members').update({
    member_status: 'left',
    left_at: new Date().toISOString(),
  }).eq('room_id', parsedRoomId.data).eq('anonymous_session_id', sessionId)
  await supabase.from('study_room_session_audit').insert({
    room_id: parsedRoomId.data,
    anonymous_session_id: sessionId,
    action: 'left',
  })
  const active = await supabase.from('study_room_members').select('id').eq('room_id', parsedRoomId.data).eq('member_status', 'active')
  if (!active.data?.length) {
    await supabase.from('study_rooms').update({ room_status: 'expired', ended_at: new Date().toISOString() }).eq('id', parsedRoomId.data)
  }
  return NextResponse.json({ ok: true })
}
