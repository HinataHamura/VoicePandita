'use client'

import type { CurriculumChunk } from '@/types'

const EMBEDDING_API_URL = process.env.NEXT_PUBLIC_TTS_URL || 'http://localhost:8001'

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${EMBEDDING_API_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      console.warn('[Embeddings] failed to generate embedding:', response.status)
      return null
    }

    const data = await response.json()
    if (!Array.isArray(data.embedding)) {
      console.warn('[Embeddings] invalid embedding payload', data)
      return null
    }

    return data.embedding as number[]
  } catch (error) {
    console.warn('[Embeddings] error generating embedding', error)
    return null
  }
}

export async function searchCurriculum(
  query: string,
  supabase: any,
  similarityThreshold = 0.5,
  matchCount = 3
): Promise<Array<{ content: string; topic: string; similarity: number }>> {
  const embedding = await generateEmbedding(query)
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('curriculum_embeddings')
      .select('id, content, subject, chapter, topic')
      .filter('embedding', 'match', embedding)
      .limit(matchCount)

    if (error) {
      console.warn('[Embeddings] supabase search error', error)
      return []
    }

    if (!Array.isArray(data)) return []

    return data.map((item: any) => ({
      content: String(item.content || ''),
      topic: String(item.topic || item.chapter || 'Curriculum'),
      similarity: 0,
    }))
  } catch (error) {
    console.warn('[Embeddings] failed to search curriculum', error)
    return []
  }
}
