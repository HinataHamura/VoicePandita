import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { fallbackEmbedding } from '@/lib/fallbackEmbedding'
import { geminiTextModels } from '@/lib/ai/models'

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

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null

function cleanText(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function normalizeQuestionText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF\s]/g, ' ')
    .replace(/\b(my name is|ami|amar|from|phone|device|location)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function keywordsFrom(value: string) {
  const stop = new Set(['what', 'why', 'how', 'the', 'and', 'with', 'this', 'that', 'কী', 'কেন', 'কিভাবে', 'কি', 'হলো', 'মানে'])
  return Array.from(new Set(
    value
      .replace(/[^\w\u0980-\u09FF\s]/g, ' ')
      .split(/\s+/)
      .map(item => item.trim())
      .filter(item => item.length > 2 && !stop.has(item.toLowerCase()))
  )).slice(0, 8)
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

function bestExplanationFor(topic: string, count: number) {
  if (/newton|force/i.test(topic)) return 'Force, mass, and acceleration are connected: more force increases acceleration, while more mass needs more force for the same acceleration.'
  if (/photosynthesis|salok/i.test(topic)) return 'Plants use sunlight, water, and carbon dioxide to make glucose, and oxygen comes out as a result.'
  if (/mineral|খনিজ/i.test(topic)) return 'Minerals are natural substances from Earth, useful for metals, fuel, construction, and industry.'
  return clarificationFor(topic, count)
}

async function generateCommunityExplanation(params: {
  topic: string
  subject: string
  count: number
  samples: string[]
}) {
  if (!genAI || params.count < 3) return bestExplanationFor(params.topic, params.count)

  try {
    const prompt = `You are VoicePandita's Peer Wisdom Network.
Create a better community clarification in Bangla for students.

Subject: ${params.subject}
Concept: ${params.topic}
Number of similar student asks: ${params.count}
Sample anonymous questions:
${params.samples.slice(0, 5).map((sample, index) => `${index + 1}. ${sample}`).join('\n')}

Rules:
- Max 80 words.
- Explain the common confusion directly.
- Use warm student-friendly Bangla.
- No personal data, no markdown.`

    let lastError: unknown = null
    for (const modelName of geminiTextModels()) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        const text = result.response.text().trim()
        if (text) return text
      } catch (err) {
        lastError = err
        console.warn(`[PWN] Gemini failed: ${modelName}`, err instanceof Error ? err.message : err)
      }
    }
    if (lastError) throw lastError
    return bestExplanationFor(params.topic, params.count)
  } catch (err) {
    console.warn('[PWN] Gemini clarification fallback:', err instanceof Error ? err.message : err)
    return bestExplanationFor(params.topic, params.count)
  }
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
    let aggregateQuery = supabase
      .from('pwn_questions')
      .select('id, subject, concept, topic, normalized_question, total_asks, last_asked_at, top_keywords, sample_questions, emotion_pattern')
      .order('total_asks', { ascending: false })
      .order('last_asked_at', { ascending: false })
      .limit(50)

    if (subject) aggregateQuery = aggregateQuery.eq('subject', subject)

    const { data, error } = await aggregateQuery
    if (error) throw error

    const questionIds = (data || []).map(item => item.id).filter(Boolean)
    const insightMap = new Map<string, { best_explanation?: string | null; common_confusion?: string | null }>()
    if (questionIds.length) {
      const insights = await supabase
        .from('pwn_insights')
        .select('question_id,best_explanation,common_confusion')
        .in('question_id', questionIds)

      if (!insights.error) {
        for (const insight of insights.data || []) {
          insightMap.set(insight.question_id, insight)
        }
      }
    }

    const hotspots = (data || [])
      .filter(item => Number(item.total_asks || 0) > 0)
      .slice(0, 20)
      .map(item => ({
        id: item.id,
        topic: item.concept || item.topic || item.normalized_question || 'Learning concept',
        subject: item.subject || 'unknown',
        count: Number(item.total_asks || 1),
        clarification: insightMap.get(item.id)?.best_explanation ||
          bestExplanationFor(item.concept || item.topic || 'Learning concept', Number(item.total_asks || 1)),
        samples: item.sample_questions || [],
        topKeywords: item.top_keywords || [],
        emotionPattern: item.emotion_pattern || 'mixed',
        lastAskedAt: item.last_asked_at,
      }))

    const subjectCounts = new Map<string, number>()
    hotspots.forEach(item => subjectCounts.set(item.subject, (subjectCounts.get(item.subject) || 0) + item.count))
    const topSubject = Array.from(subjectCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all'
    const stats = {
      totalAsks: hotspots.reduce((sum, item) => sum + item.count, 0),
      trendingCount: hotspots.filter(item => item.count >= 3).length,
      topSubject,
    }

    return NextResponse.json({ hotspots, total: hotspots.length, stats, source: 'supabase' })
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
    const normalizedQuestion = normalizeQuestionText(topic || question)
    const topKeywords = keywordsFrom(`${question} ${topic} ${graphPath.join(' ')}`)

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
    const existing = await supabase
      .from('pwn_questions')
      .select('id,total_asks,sample_questions,top_keywords')
      .eq('subject', subject)
      .eq('normalized_question', normalizedQuestion)
      .maybeSingle()

    let data
    let error

    if (existing.data) {
      const samples = Array.isArray(existing.data.sample_questions) ? existing.data.sample_questions : []
      const mergedSamples = Array.from(new Set([question, ...samples])).slice(0, 5)
      const keywords = Array.from(new Set([...(existing.data.top_keywords || []), ...topKeywords])).slice(0, 10)
      const result = await supabase
        .from('pwn_questions')
        .update({
          question_text: question,
          embedding,
          topic,
          concept: topic,
          cluster_id: clusterId,
          total_asks: Number(existing.data.total_asks || 0) + 1,
          last_asked_at: new Date().toISOString(),
          sample_questions: mergedSamples,
          top_keywords: keywords,
          session_id: sessionId,
        })
        .eq('id', existing.data.id)
        .select('id, subject, concept, topic, cluster_id, total_asks, last_asked_at')
        .single()
      data = result.data
      error = result.error
    } else {
      const result = await supabase
      .from('pwn_questions')
      .insert({
        normalized_question: normalizedQuestion,
        question_text: question,
        embedding,
        subject,
        topic,
        concept: topic,
        total_asks: Math.max(1, similarQuestions.length + 1),
        last_asked_at: new Date().toISOString(),
        top_keywords: topKeywords,
        sample_questions: [question],
        emotion_pattern: cleanText(body.emotion, 40) || 'mixed',
        cluster_id: clusterId,
        session_id: sessionId,
      })
      .select('id, subject, concept, topic, cluster_id, total_asks, last_asked_at')
      .single()
      data = result.data
      error = result.error
    }

    if (error) throw error

    if (data?.id) {
      const insightTopic = data.concept || data.topic || topic
      const count = Number(data.total_asks || 1)
      const samples = existing.data
        ? Array.from(new Set([question, ...((existing.data.sample_questions as string[] | null) || [])])).slice(0, 5)
        : [question]
      const bestExplanation = await generateCommunityExplanation({
        topic: insightTopic,
        subject,
        count,
        samples,
      })
      await supabase
        .from('pwn_insights')
        .upsert({
          question_id: data.id,
          common_confusion: clarificationFor(insightTopic, count),
          best_explanation: bestExplanation,
          top_keywords: topKeywords,
          emotion_pattern: cleanText(body.emotion, 40) || 'mixed',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'question_id' })
    }

    console.info('[PWN] Stored student question vector:', data)
    return NextResponse.json({
      stored: true,
      row: data,
      similarCount: similarQuestions.length,
      anonymized: true,
      message: `${Number(data?.total_asks || 1)} students were confused about this concept`,
    })
  } catch (err) {
    console.error('/api/pwn POST error:', err)
    return NextResponse.json(
      { stored: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
