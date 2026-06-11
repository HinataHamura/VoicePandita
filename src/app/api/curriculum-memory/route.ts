import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fallbackEmbedding } from '@/lib/fallbackEmbedding'

function cleanText(value: unknown, max = 4000) {
  return String(value || '').trim().slice(0, max)
}

function memorySourceId(subject: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `student-question:${subject}:${id}`
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const question = cleanText(body.question, 1000)
    const answer = cleanText(body.answer, 3000)
    const subject = cleanText(body.subject, 80) || 'unknown'
    const graphPath = Array.isArray(body.graphPath)
      ? body.graphPath.map((part: unknown) => cleanText(part, 80)).filter(Boolean)
      : []

    if (!question) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
    }

    const content = answer
      ? `Student question: ${question}\nTutor answer: ${answer}`
      : `Student question: ${question}`
    const embedding = await generateEmbedding(content)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        stored: false,
        skipped: true,
        error: 'Supabase service role env missing',
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const row = {
      content,
      subject,
      chapter: graphPath[1] || graphPath[0] || 'Student Questions',
      topic: graphPath[graphPath.length - 1] || question.slice(0, 80),
      source_doc_id: memorySourceId(subject),
      chunk_index: 0,
      chunk_type: 'student-memory',
      token_count: content.split(/\s+/).filter(Boolean).length,
      contextual_summary: 'Student-generated question and tutor answer memory. Used for analytics/memory, not curriculum grounding.',
      embedding_text: content,
      source_type: 'student',
      question_text: question,
      answer_text: answer || null,
      metadata: {
        graphPath,
        storedBy: 'curriculum-memory-api',
      },
      embedding,
    }

    const { data, error } = await supabase
      .from('curriculum_embeddings')
      .insert(row)
      .select('id, subject, chapter, topic')
      .single()

    if (error) throw error

    console.info('[VectorRAG] Stored student question in curriculum_embeddings:', data)
    return NextResponse.json({ stored: true, row: data })
  } catch (err) {
    console.error('/api/curriculum-memory error:', err)
    return NextResponse.json(
      { stored: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 200 }
    )
  }
}
