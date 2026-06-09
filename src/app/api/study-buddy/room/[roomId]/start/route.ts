import { NextResponse } from 'next/server'
import { generateStudyBuddyQuiz } from '@/lib/study-buddy/quiz-generator'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled } from '@/lib/study-buddy/server'
import { roomIdSchema } from '@/lib/study-buddy/validators'

export async function POST(_: Request, { params }: { params: { roomId: string } }) {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ error: 'Disabled' }, { status: 404 })
  const parsedRoomId = roomIdSchema.safeParse(params.roomId)
  if (!parsedRoomId.success) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Supabase missing' }, { status: 503 })

  const sessionId = getOrCreateAnonymousSessionId()
  const [member, room, members] = await Promise.all([
    supabase.from('study_room_members').select('id').eq('room_id', parsedRoomId.data).eq('anonymous_session_id', sessionId).maybeSingle(),
    supabase.from('study_rooms').select('*').eq('id', parsedRoomId.data).single(),
    supabase.from('study_room_members').select('id').eq('room_id', parsedRoomId.data).eq('member_status', 'active'),
  ])
  if (!member.data || !room.data) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.data.room_status !== 'waiting') return NextResponse.json({ status: room.data.room_status })
  if ((members.data?.length || 0) < Number(room.data.min_members || 3)) return NextResponse.json({ error: 'Need more students' }, { status: 409 })

  const existing = await supabase.from('study_room_questions').select('id').eq('room_id', parsedRoomId.data).limit(1)
  if (!existing.data?.length) {
    const quiz = await generateStudyBuddyQuiz(room.data.topic_title, room.data.subject)
    await supabase.from('study_room_questions').insert(quiz.questions.map(question => ({
      room_id: parsedRoomId.data,
      question_order: question.questionOrder,
      question_type: question.questionType,
      prompt_bn: question.promptBn,
      options: question.options,
      correct_answer: question.correctAnswer,
      hint_bn: question.hintBn,
      explanation_bn: question.explanationBn,
      difficulty: question.difficulty,
      concept_tag: question.conceptTag,
    })))
    await supabase.from('study_room_messages').insert({
      room_id: parsedRoomId.data,
      sender_type: 'ai_host',
      message_type: 'system',
      content: quiz.warmupBn,
      safe_content: quiz.warmupBn,
      metadata: { learningGoalBn: quiz.learningGoalBn, closingSummaryBn: quiz.closingSummaryBn },
    })
  }

  await supabase.from('study_rooms').update({ room_status: 'active', started_at: new Date().toISOString() }).eq('id', parsedRoomId.data)
  return NextResponse.json({ status: 'active' })
}
