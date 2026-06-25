import { NextResponse } from 'next/server'
import { deriveTopic } from '@/lib/study-buddy/topic'
import { findMatchingRoom } from '@/lib/study-buddy/matching'
import { generateStudyBuddyQuiz, isWeakStudyBuddyQuestion } from '@/lib/study-buddy/quiz-generator'
import { getOrCreateAnonymousSessionId, getStudyBuddyConfig, getSupabaseAdmin, isStudyBuddyEnabled, logStudyBuddyEvent } from '@/lib/study-buddy/server'
import { joinStudyBuddySchema } from '@/lib/study-buddy/validators'
import type { StudyBuddyJoinResponse, StudyBuddyLanguage } from '@/lib/study-buddy/types'

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

type JoinRoom = {
  id: string
  topic_title: string
  room_status: 'waiting' | 'active' | 'completed' | 'cancelled' | 'expired'
  min_members: number
  max_members: number
  subject?: string | null
}

async function ensureQuiz(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, roomId: string, topicTitle: string, subject?: string | null) {
  const existing = await supabase.from('study_room_questions').select('id, prompt_bn, options').eq('room_id', roomId).order('question_order').limit(5)
  const hasWeakQuestions = (existing.data || []).some(isWeakStudyBuddyQuestion)
  if (existing.data?.length && !hasWeakQuestions) return
  if (hasWeakQuestions) {
    await supabase.from('study_room_questions').delete().eq('room_id', roomId)
    await supabase.from('study_room_messages').delete().eq('room_id', roomId).in('message_type', ['system', 'explanation'])
  }

  const quiz = await generateStudyBuddyQuiz(topicTitle, subject)
  await supabase.from('study_room_messages').insert({
    room_id: roomId,
    sender_type: 'ai_host',
    message_type: 'system',
    content: quiz.warmupBn,
    safe_content: quiz.warmupBn,
    metadata: { learningGoalBn: quiz.learningGoalBn, closingSummaryBn: quiz.closingSummaryBn },
  })
  await supabase.from('study_room_questions').insert(quiz.questions.map(question => ({
    room_id: roomId,
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
}

export async function POST(req: Request) {
  if (!isStudyBuddyEnabled()) {
    return NextResponse.json({ error: 'Bondhu Study Room is disabled' }, { status: 404 })
  }

  const parsed = joinStudyBuddySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid study room request', details: parsed.error.flatten() }, { status: 400 })
  }

  const config = getStudyBuddyConfig()
  const sessionId = getOrCreateAnonymousSessionId(parsed.data.anonymousSessionId)
  const language = (parsed.data.language || 'bn') as StudyBuddyLanguage
  const topic = deriveTopic({
    questionText: parsed.data.questionText,
    subject: parsed.data.subject,
    conceptHint: parsed.data.conceptHint,
  })
  const supabase = getSupabaseAdmin()

  if (!supabase) {
    const roomId = crypto.randomUUID()
    const response: StudyBuddyJoinResponse = {
      roomId,
      status: 'waiting',
      memberCount: 1,
      minMembers: config.minMembers,
      maxMembers: config.maxMembers,
      topicTitle: topic.topicTitle,
      redirectUrl: `/study-buddy/${roomId}?demo=1&topic=${encodeURIComponent(topic.topicTitle)}`,
    }
    return NextResponse.json(response)
  }

  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const attempts = await supabase
      .from('study_room_members')
      .select('id', { count: 'exact', head: true })
      .eq('anonymous_session_id', sessionId)
      .gte('joined_at', since)
    if ((attempts.count || 0) >= 5) {
      return NextResponse.json({ error: 'Too many join attempts. Please try again later.' }, { status: 429 })
    }

    let room = await findMatchingRoom({
      supabase,
      topicKey: topic.topicKey,
      language,
      classLevel: parsed.data.classLevel,
      maxMembers: config.maxMembers,
    }) as JoinRoom | null

    const isSolo = parsed.data.solo === true
    if (!room || isSolo) {
      const expiresAt = new Date(Date.now() + config.waitTimeoutSeconds * 1000).toISOString()
      const created = await supabase.from('study_rooms').insert({
        topic_key: isSolo ? `${topic.topicKey}-solo-${Date.now()}` : topic.topicKey,
        topic_title: topic.topicTitle,
        subject: topic.subject,
        class_level: parsed.data.classLevel || null,
        language,
        source_question: parsed.data.questionText.slice(0, 1000),
        source_question_hash: topic.topicKey,
        min_members: isSolo ? 1 : config.minMembers,
        max_members: isSolo ? 1 : config.maxMembers,
        expires_at: expiresAt,
        created_by_session_id: sessionId,
      }).select('id, topic_title, room_status, min_members, max_members, subject').single()
      if (created.error) throw created.error
      room = created.data as JoinRoom
      await logStudyBuddyEvent('room_created', { roomId: room.id, topicKey: topic.topicKey })
    }

    const memberCountResult = await supabase.from('study_room_members').select('id', { count: 'exact', head: true }).eq('room_id', room.id)
    const adjectives = ['Smart', 'Curious', 'Quick', 'Patient', 'Brave', 'Calm', 'Kind', 'Bold', 'Wise', 'Keen']
    const colors = ['Red', 'Blue', 'Green', 'Gold', 'Purple', 'Indigo', 'Coral', 'Sky', 'Forest', 'Amber']
    const seed = simpleHash(`${room.id}${sessionId}`)
    const adjIdx = seed % adjectives.length
    const colorIdx = Math.floor(seed / adjectives.length) % colors.length
    const alias = `${adjectives[adjIdx]} ${colors[colorIdx]}`
    const memberInsert = await supabase.from('study_room_members').upsert({
      room_id: room.id,
      anonymous_session_id: sessionId,
      display_alias: alias,
      avatar_seed: `${topic.topicKey}-${alias}`,
      member_status: 'active',
      last_seen_at: new Date().toISOString(),
      left_at: null,
    }, { onConflict: 'room_id,anonymous_session_id' })
    if (memberInsert.error) throw memberInsert.error

    await supabase.from('study_room_session_audit').insert({
      room_id: room.id,
      anonymous_session_id: sessionId,
      action: 'joined',
    })

    const members = await supabase.from('study_room_members').select('id').eq('room_id', room.id).eq('member_status', 'active')
    const memberCount = members.data?.length || 1
    let status = room.room_status
    if (status === 'waiting' && memberCount >= Number(room.min_members || config.minMembers)) {
      await ensureQuiz(supabase, room.id, room.topic_title || topic.topicTitle, topic.subject)
      const updated = await supabase.from('study_rooms').update({
        room_status: 'active',
        started_at: new Date().toISOString(),
      }).eq('id', room.id).select('room_status').single()
      status = updated.data?.room_status || 'active'
      await logStudyBuddyEvent('room_started', { roomId: room.id, memberCount })
    }

    await logStudyBuddyEvent('room_joined', { roomId: room.id, topicKey: topic.topicKey })

    const response: StudyBuddyJoinResponse = {
      roomId: room.id,
      status,
      memberCount,
      minMembers: Number(room.min_members || config.minMembers),
      maxMembers: Number(room.max_members || config.maxMembers),
      topicTitle: room.topic_title || topic.topicTitle,
      redirectUrl: `/study-buddy/${room.id}`,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('/api/study-buddy/join error:', error)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'PGRST205'
    ) {
      return NextResponse.json({
        error: 'Study Room database is not migrated yet. Run supabase db push, then retry.',
        setupRequired: true,
      }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not join Bondhu Study Room' }, { status: 500 })
  }
}
