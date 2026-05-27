import { NextRequest, NextResponse } from 'next/server'
import { fallbackEmbedding } from '@/lib/fallbackEmbedding'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const text = String(body.text || '').trim()

  if (!text) {
    return NextResponse.json({ error: 'Text required' }, { status: 400 })
  }

  const embedUrl = process.env.NEXT_PUBLIC_TTS_URL || 'http://localhost:8001'

  try {
    const response = await fetch(`${embedUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data.embedding) && data.embedding.length === 384) {
        return NextResponse.json({
          embedding: data.embedding,
          dimension: 384,
          source: data.source || 'python-embedding-server',
        })
      }
    }
  } catch {
    // The Python embedding server is optional during local development.
  }

  return NextResponse.json({
    embedding: fallbackEmbedding(text),
    dimension: 384,
    source: 'typescript-fallback',
  })
}
