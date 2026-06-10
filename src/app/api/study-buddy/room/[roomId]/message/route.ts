import { NextResponse } from 'next/server'
import { canSendFreeText, sanitizeStudentMessage, unsafeMessageBn, detectSpam } from '@/lib/study-buddy/moderation'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled } from '@/lib/study-buddy/server'
import { messageSchema, roomIdSchema } from '@/lib/study-buddy/validators'

export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ error: 'Disabled' }, { status: 404 })
  const parsedRoomId = roomIdSchema.safeParse(params.roomId)
  const parsedBody = messageSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsedRoomId.success || !parsedBody.success) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Supabase missing' }, { status: 503 })

  try {
    const sessionId = getOrCreateAnonymousSessionId()
    const member = await supabase
      .from('study_room_members')
      .select('id, member_status')
      .eq('room_id', parsedRoomId.data)
      .eq('anonymous_session_id', sessionId)
      .maybeSingle()

    if (!member.data || !['active', 'idle'].includes(member.data.member_status)) {
      return NextResponse.json({ error: 'Not a room member' }, { status: 403 })
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const recentMessages = await supabase
      .from('study_room_messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', parsedRoomId.data)
      .eq('sender_session_id', sessionId)
      .gte('created_at', oneMinuteAgo)

    if ((recentMessages.count || 0) >= 8) {
      return NextResponse.json({ error: 'একটু ধীরে message পাঠাও।' }, { status: 429 })
    }

    // Room-wide spam check: >15 messages in 30s
    const last30sec = await supabase
      .from('study_room_messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', parsedRoomId.data)
      .gt('created_at', new Date(Date.now() - 30000).toISOString())

    if ((last30sec.count || 0) > 15) {
      return NextResponse.json({ error: 'Room খুব busy, একটু অপেক্ষা করো।' }, { status: 429 })
    }

    if (!canSendFreeText(parsedBody.data.content)) {
      return NextResponse.json({ error: unsafeMessageBn }, { status: 400 })
    }

    const spamCheck = detectSpam(parsedBody.data.content)
    if (spamCheck.isSpam) {
      return NextResponse.json({ error: unsafeMessageBn }, { status: 400 })
    }

    const safeContent = sanitizeStudentMessage(parsedBody.data.content)
    const inserted = await supabase.from('study_room_messages').insert({
      room_id: parsedRoomId.data,
      sender_type: 'student',
      sender_session_id: sessionId,
      message_type: 'text',
      content: safeContent,
      safe_content: safeContent,
      metadata: { moderated: true },
    }).select('id, room_id, sender_type, sender_session_id, message_type, content, safe_content, metadata, created_at').single()

    if (inserted.error) throw inserted.error
    await supabase.from('study_room_members').update({ last_seen_at: new Date().toISOString() }).eq('id', member.data.id)

    return NextResponse.json({ message: inserted.data })
  } catch (error) {
    console.error('/api/study-buddy/message error:', error)
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 })
  }
}
