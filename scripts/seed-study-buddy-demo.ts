import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

async function main() {
  const room = await supabase.from('study_rooms').insert({
    topic_key: 'physics-newtons-second-law',
    topic_title: "Newton's Second Law",
    subject: 'physics',
    class_level: 'ssc',
    language: 'bn',
    source_question: 'Newton-er second law bujhi na',
    source_question_hash: 'physics-newtons-second-law',
    room_status: 'waiting',
    min_members: 3,
    max_members: 5,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    created_by_session_id: crypto.randomUUID(),
  }).select('id').single()

  if (room.error) throw room.error
  const roomId = room.data.id
  const sessions = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]

  await supabase.from('study_room_members').insert(sessions.map((sessionId, index) => ({
    room_id: roomId,
    anonymous_session_id: sessionId,
    display_alias: `Bondhu ${index + 1}`,
    avatar_seed: `newton-${index + 1}`,
  })))

  await supabase.from('study_room_questions').insert([1, 2, 3, 4, 5].map(order => ({
    room_id: roomId,
    question_order: order,
    question_type: 'mcq',
    prompt_bn: order === 1 ? 'F = ma সূত্রে m কোন জিনিস বোঝায়?' : `Newton second law concept-check ${order}`,
    options: [
      { id: 'A', text: 'ভর' },
      { id: 'B', text: 'রং' },
      { id: 'C', text: 'সময়' },
      { id: 'D', text: 'তাপমাত্রা' },
    ],
    correct_answer: { id: 'A' },
    hint_bn: 'm মানে mass.',
    explanation_bn: 'F = ma তে F হলো force, m হলো mass বা ভর, আর a হলো acceleration বা ত্বরণ।',
    difficulty: 'easy',
    concept_tag: "Newton's Second Law",
  })))

  console.log(`Seeded Bondhu Study Room: ${roomId}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
