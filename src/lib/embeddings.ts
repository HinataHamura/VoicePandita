export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.info('[VectorRAG] Generating embedding for question:', text)
    const response = await fetch('/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) throw new Error(`Embeddings API error: ${response.status}`)
    const data = await response.json()
    console.info('[VectorRAG] Embedding generated:', {
      dimension: Array.isArray(data.embedding) ? data.embedding.length : 0,
      source: data.source || 'unknown',
    })
    return data.embedding
  } catch (e) {
    console.error('[VectorRAG] Failed to generate embedding:', e)
    return []
  }
}

export async function searchCurriculum(
  query: string,
  supabase: any,
  threshold = 0.5,
  limit = 3
) {
  try {
    const embedding = await generateEmbedding(query)
    if (!embedding.length) {
      console.warn('[VectorRAG] No embedding generated for query')
      return []
    }

    console.info('[VectorRAG] Calling Supabase RPC search_curriculum', { threshold, limit })
    const { data, error } = await supabase.rpc('search_curriculum', {
      query_embedding: embedding,
      similarity_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      console.error('[VectorRAG] Curriculum search error:', error)
      return []
    }

    const cleanData = (data || []).filter((chunk: any) =>
      typeof chunk.content === 'string' &&
      !chunk.content.trim().toLowerCase().startsWith('student question:')
    ).map((chunk: any) => ({
      ...chunk,
      contextText: chunk.context_text || [chunk.contextual_summary, chunk.content].filter(Boolean).join('\n\n'),
    }))

    console.info(`[VectorRAG] Vector search found ${cleanData.length} curriculum chunks for question:`, query, cleanData)
    return cleanData
  } catch (e) {
    console.error('[VectorRAG] Failed to search curriculum:', e)
    return []
  }
}
