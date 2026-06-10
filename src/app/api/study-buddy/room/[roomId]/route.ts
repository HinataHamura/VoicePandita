import { NextResponse } from 'next/server'
import { generateStudyBuddyQuiz } from '@/lib/study-buddy/quiz-generator'
import { getOrCreateAnonymousSessionId, getSupabaseAdmin, isStudyBuddyEnabled } from '@/lib/study-buddy/server'
import { roomIdSchema } from '@/lib/study-buddy/validators'

function demoRoom(roomId: string, topicTitle: string) {
  const now = new Date().toISOString()
  const quizPromise = generateStudyBuddyQuiz(topicTitle)
  return quizPromise.then(quiz => NextResponse.json({
    room: {
      id: roomId,
      topic_title: topicTitle,
      topic_key: 'demo-topic',
      subject: null,
      class_level: null,
      language: 'bn',
      source_question: null,
      room_status: 'active',
      min_members: 3,
      max_members: 5,
      expires_at: new Date(Date.now() + 90000).toISOString(),
      started_at: null,
      ended_at: null,
      created_at: now,
      updated_at: now,
    },
    members: [{
      id: 'demo-member',
      room_id: roomId,
      display_alias: 'Bondhu 1',
      avatar_seed: 'demo',
      member_status: 'active',
      joined_at: now,
      last_seen_at: now,
      left_at: null,
    }],
    questions: quiz.questions.map((question, index) => ({
      id: crypto.randomUUID(),
      room_id: roomId,
      question_order: index + 1,
      question_type: 'mcq',
      prompt_bn: question.promptBn,
      options: question.options,
      correct_answer: question.correctAnswer,
      hint_bn: question.hintBn,
      explanation_bn: question.explanationBn,
      difficulty: question.difficulty,
      concept_tag: question.conceptTag,
    })),
    messages: [{
      id: crypto.randomUUID(),
      room_id: roomId,
      sender_type: 'ai_host',
      sender_session_id: null,
      message_type: 'system',
      content: quiz.warmupBn,
      safe_content: quiz.warmupBn,
      metadata: { closingSummaryBn: quiz.closingSummaryBn },
      created_at: now,
    }],
    answers: [],
    sessionId: 'demo',
  }))
}

export async function GET(req: Request, { params }: { params: { roomId: string } }) {
  if (!isStudyBuddyEnabled()) return NextResponse.json({ error: 'Bondhu Study Room is disabled' }, { status: 404 })
  const url = new URL(req.url)
  const isDemo = url.searchParams.get('demo') === '1'
  const topicTitle = url.searchParams.get('topic') || 'Bondhu Study Room'
  if (isDemo) return demoRoom(params.roomId, topicTitle)

  const parsedRoomId = roomIdSchema.safeParse(params.roomId)
  if (!parsedRoomId.success) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured for Study Room' }, { status: 503 })

  const sessionId = getOrCreateAnonymousSessionId()
  const member = await supabase
    .from('study_room_members')
    .select('id')
    .eq('room_id', parsedRoomId.data)
    .eq('anonymous_session_id', sessionId)
    .maybeSingle()
  if (member.error || !member.data) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const [room, members, questions, messages, answers] = await Promise.all([
    supabase.from('study_rooms').select('*').eq('id', parsedRoomId.data).single(),
    supabase.from('study_room_members').select('display_alias, avatar_seed, member_status, joined_at, last_seen_at').eq('room_id', parsedRoomId.data).order('joined_at'),
    supabase.from('study_room_questions').select('*').eq('room_id', parsedRoomId.data).order('question_order'),
    supabase.from('study_room_messages').select('*').eq('room_id', parsedRoomId.data).order('created_at', { ascending: true }).limit(80),
    supabase.from('study_room_answers').select('id, room_id, question_id, anonymous_session_id, answer, is_correct, answered_at, response_ms').eq('room_id', parsedRoomId.data),
  ])

  if (room.error) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json({
    room: room.data,
    members: members.data || [],
    questions: questions.data || [],
    messages: messages.data || [],
    answers: answers.data || [],
  })
}
