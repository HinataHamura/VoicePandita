import { NextResponse } from 'next/server'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled, logStudyBuddyEvent } from '@/lib/study-buddy/server'
import { roomIdSchema } from '@/lib/study-buddy/validators'

export async function POST(_: Request, { params }: { params: { roomId: string } }) {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ error: 'Disabled' }, { status: 404 })
  const parsedRoomId = roomIdSchema.safeParse(params.roomId)
  if (!parsedRoomId.success) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Supabase missing' }, { status: 503 })

  try {
    const sessionId = getOrCreateAnonymousSessionId()
    const member = await supabase
      .from('study_room_members')
      .select('id')
      .eq('room_id', parsedRoomId.data)
      .eq('anonymous_session_id', sessionId)
      .maybeSingle()
    if (!member.data) return NextResponse.json({ error: 'Not a room member' }, { status: 403 })

    const questions = await supabase.from('study_room_questions').select('*').eq('room_id', parsedRoomId.data).order('question_order')
    const messages = await supabase.from('study_room_messages').select('metadata').eq('room_id', parsedRoomId.data).eq('message_type', 'explanation')
    const explained = new Set((messages.data || []).map((message: any) => message.metadata?.questionId).filter(Boolean))
    const next = (questions.data || []).find(question => !explained.has(question.id))

    if (!next) {
      await supabase.from('study_rooms').update({ room_status: 'completed', ended_at: new Date().toISOString() }).eq('id', parsedRoomId.data)
      await supabase.from('study_room_messages').insert({
        room_id: parsedRoomId.data,
        sender_type: 'ai_host',
        message_type: 'system',
        content: 'আজকে তোমরা যা শিখলে: concept টা examples দিয়ে বুঝতে চেষ্টা করেছো। ব্যক্তিগত তথ্য share না করার জন্য ধন্যবাদ।',
        safe_content: 'আজকে তোমরা যা শিখলে: concept টা examples দিয়ে বুঝতে চেষ্টা করেছো। ব্যক্তিগত তথ্য share না করার জন্য ধন্যবাদ।',
        metadata: { completed: true },
      })
      await logStudyBuddyEvent('room_completed', { roomId: parsedRoomId.data })
      return NextResponse.json({ status: 'completed' })
    }

    await supabase.from('study_room_messages').insert({
      room_id: parsedRoomId.data,
      sender_type: 'ai_host',
      message_type: 'explanation',
      content: next.explanation_bn,
      safe_content: next.explanation_bn,
      metadata: { questionId: next.id, questionOrder: next.question_order },
    })
    return NextResponse.json({ status: 'active', explanationFor: next.id })
  } catch (error) {
    console.error('/api/study-buddy/next error:', error)
    return NextResponse.json({ error: 'Could not continue room' }, { status: 500 })
  }
}
