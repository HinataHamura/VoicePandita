import { NextResponse } from 'next/server'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled } from '@/lib/study-buddy/server'
import { reportSchema, roomIdSchema } from '@/lib/study-buddy/validators'

export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ error: 'Disabled' }, { status: 404 })
  const parsedRoomId = roomIdSchema.safeParse(params.roomId)
  const parsedBody = reportSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsedRoomId.success || !parsedBody.success) return NextResponse.json({ error: 'Invalid report' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ ok: true })
  const sessionId = getOrCreateAnonymousSessionId()
  const member = await supabase.from('study_room_members').select('id').eq('room_id', parsedRoomId.data).eq('anonymous_session_id', sessionId).maybeSingle()
  if (!member.data) return NextResponse.json({ error: 'Not a room member' }, { status: 403 })
  await supabase.from('study_room_reports').insert({
    room_id: parsedRoomId.data,
    reporter_session_id: sessionId,
    reported_session_id: parsedBody.data.reportedSessionId || null,
    reason: parsedBody.data.reason,
    details: parsedBody.data.details || null,
  })
  return NextResponse.json({ ok: true })
}
