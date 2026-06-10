import { NextResponse } from 'next/server'
import { isCorrectAnswer } from '@/lib/study-buddy/scoring'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled, logStudyBuddyEvent } from '@/lib/study-buddy/server'
import { answerSchema, roomIdSchema } from '@/lib/study-buddy/validators'

export async function POST(req: Request, { params }: { params: { roomId: string } }) {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ error: 'Disabled' }, { status: 404 })
  const parsedRoomId = roomIdSchema.safeParse(params.roomId)
  const parsedBody = answerSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsedRoomId.success || !parsedBody.success) return NextResponse.json({ error: 'Invalid answer' }, { status: 400 })
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

    const question = await supabase
      .from('study_room_questions')
      .select('*')
      .eq('id', parsedBody.data.questionId)
      .eq('room_id', parsedRoomId.data)
      .single()
    if (question.error || !question.data) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    const isCorrect = isCorrectAnswer(parsedBody.data.answer, question.data.correct_answer)
    const inserted = await supabase.from('study_room_answers').upsert({
      room_id: parsedRoomId.data,
      question_id: parsedBody.data.questionId,
      anonymous_session_id: sessionId,
      answer: parsedBody.data.answer,
      is_correct: isCorrect,
      response_ms: parsedBody.data.responseMs || null,
    }, { onConflict: 'question_id,anonymous_session_id' }).select('id, is_correct').single()
    if (inserted.error) throw inserted.error

    await supabase.from('study_room_messages').insert({
      room_id: parsedRoomId.data,
      sender_type: 'system',
      message_type: 'result',
      content: 'একজন Bondhu answer দিয়েছে।',
      safe_content: 'একজন Bondhu answer দিয়েছে।',
      metadata: { questionId: parsedBody.data.questionId },
    })
    await logStudyBuddyEvent('answer_submitted', { roomId: parsedRoomId.data, isCorrect })
    return NextResponse.json({ isCorrect, answerId: inserted.data.id })
  } catch (error) {
    console.error('/api/study-buddy/answer error:', error)
    return NextResponse.json({ error: 'Could not save answer' }, { status: 500 })
  }
}
