import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fallbackEmbedding } from '@/lib/fallbackEmbedding'

type SimilarQuestion = {
  id: string
  question_text: string
  subject: string
  topic: string | null
  cluster_id: string
  similarity: number
}

const FALLBACK_HOTSPOTS = [
  {
    topic: 'Newton second law',
    subject: 'physics',
    count: 47,
    clarification: 'F = ma means force changes motion through acceleration. More force gives more acceleration; more mass needs more force.',
  },
  {
    topic: 'Photosynthesis',
    subject: 'biology',
    count: 38,
    clarification: 'Plants use sunlight, water and carbon dioxide to make glucose. Oxygen is released as a result.',
  },
  {
    topic: 'Ionic bonding',
    subject: 'chemistry',
    count: 31,
    clarification: 'One atom gives an electron, another receives it. Opposite charges attract and form the ionic bond.',
  },
  {
    topic: 'Quadratic equation',
    subject: 'math',
    count: 29,
    clarification: 'First identify a, b and c in ax^2+bx+c=0. Then use x = (-b +/- sqrt(b^2-4ac)) / 2a.',
  },
]

function cleanText(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function topicFrom(question: string, graphPath: string[]) {
  const conceptPath = graphPath
    .filter(part => !['application', 'example', 'examples', 'practice', 'electron transfer'].includes(part.toLowerCase()))
    .slice(1)
  return normalizeTopic(question, conceptPath[conceptPath.length - 1] || graphPath[graphPath.length - 1])
}

function normalizeTopic(question: string, topic?: string | null) {
  const text = `${question} ${topic || ''}`.toLowerCase()

  if (/(ionic|ionic bond|ionik|ayonik|আয়নিক|bonding|electron transfer)/i.test(text)) return 'Ionic Bond'
  if (/(newton|2nd law|second law|f\s*=\s*ma|force.*motion|বল.*ত্বরণ)/i.test(text)) return "Newton's Second Law"
  if (/(photosynthesis|salok|সালোক|সালোকসংশ্লেষণ)/i.test(text)) return 'Photosynthesis'
  if (/(quadratic|দ্বিঘাত|ax\^?2|সমীকরণ)/i.test(text)) return 'Quadratic Equation'

  const cleanedTopic = String(topic || '').trim()
  if (cleanedTopic && !['Application', 'Example', 'Practice'].includes(cleanedTopic)) return cleanedTopic
  return question.replace(/\s+/g, ' ').slice(0, 80)
}

function questionWord(count: number) {
  return count === 1 ? 'question' : 'questions'
}

function clarificationFor(topic: string, count: number) {
  return `${topic} niye ${count} ta ${questionWord(count)} hoyeche. Ei concept-e students mostly definition, formula/application, ba step-by-step explanation niye confused hocche.`
}

async function generateEmbedding(text: string) {
  const embedUrl = process.env.NEXT_PUBLIC_TTS_URL || 'http://localhost:8001'
  try {
    const response = await fetch(`${embedUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) throw new Error(`Embeddings API error: ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.embedding) || data.embedding.length !== 384) {
      throw new Error('Embedding endpoint did not return a 384-dim vector')
    }
    return data.embedding as number[]
  } catch {
    return fallbackEmbedding(text)
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subject = searchParams.get('subject')
  const supabase = getSupabaseAdmin()

  if (!supabase) {
    const hotspots = subject ? FALLBACK_HOTSPOTS.filter(item => item.subject === subject) : FALLBACK_HOTSPOTS
    return NextResponse.json({ hotspots, total: hotspots.length, source: 'fallback' })
  }

  try {
    let query = supabase
      .from('pwn_questions')
      .select('subject, topic, question_text, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (subject) query = query.eq('subject', subject)

    const { data, error } = await query
    if (error) throw error

    const clusters = new Map<string, {
      topic: string
      subject: string
      count: number
      latest: string
      samples: string[]
    }>()

    for (const item of data || []) {
      const topic = normalizeTopic(item.question_text || '', item.topic)
      const key = `${item.subject || 'unknown'}:${topic}`.toLowerCase()
      const current = clusters.get(key)
      if (!current) {
        clusters.set(key, {
          topic,
          subject: item.subject || 'unknown',
          count: 1,
          latest: item.created_at,
          samples: item.question_text ? [item.question_text] : [],
        })
      } else {
        current.count += 1
        if (item.question_text && current.samples.length < 3) current.samples.push(item.question_text)
        if (item.created_at > current.latest) {
          current.latest = item.created_at
        }
      }
    }

    const hotspots = Array.from(clusters.values())
      .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))
      .slice(0, 20)
      .map(item => ({
        topic: item.topic,
        subject: item.subject,
        count: item.count,
        clarification: clarificationFor(item.topic, item.count),
        samples: item.samples,
      }))

    return NextResponse.json({ hotspots, total: hotspots.length, source: 'supabase' })
  } catch (err) {
    console.error('/api/pwn GET error:', err)
    const hotspots = subject ? FALLBACK_HOTSPOTS.filter(item => item.subject === subject) : FALLBACK_HOTSPOTS
    return NextResponse.json({ hotspots, total: hotspots.length, source: 'fallback' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const question = cleanText(body.question, 1000)
    const subject = cleanText(body.subject, 80) || 'unknown'
    const sessionId = cleanText(body.sessionId, 120) || 'anonymous'
    const graphPath = Array.isArray(body.graphPath)
      ? body.graphPath.map((part: unknown) => cleanText(part, 80)).filter(Boolean)
      : []
    const topic = topicFrom(question, graphPath)

    if (!question) {
      return NextResponse.json({ stored: false, error: 'Question required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ stored: false, skipped: true, reason: 'Supabase service role env missing' })
    }

    const embedding = await generateEmbedding(question)
    let similarQuestions: SimilarQuestion[] = []

    const similar = await supabase.rpc('search_pwn_questions', {
      query_embedding: embedding,
      similarity_threshold: 0.82,
      match_count: 5,
      subject_filter: subject,
    })

    if (similar.error) {
      console.warn('[PWN] search_pwn_questions skipped:', similar.error.message)
    } else {
      similarQuestions = similar.data || []
    }

    const clusterId = similarQuestions[0]?.cluster_id || crypto.randomUUID()
    const { data, error } = await supabase
      .from('pwn_questions')
      .insert({
        question_text: question,
        embedding,
        subject,
        topic,
        cluster_id: clusterId,
        session_id: sessionId,
      })
      .select('id, subject, topic, cluster_id, created_at')
      .single()

    if (error) throw error

    console.info('[PWN] Stored student question vector:', data)
    return NextResponse.json({
      stored: true,
      row: data,
      similarCount: similarQuestions.length,
      anonymized: true,
    })
  } catch (err) {
    console.error('/api/pwn POST error:', err)
    return NextResponse.json(
      { stored: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
