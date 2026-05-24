export async function generateEmbedding(text: string): Promise<number[]> {
  const embedUrl = process.env.NEXT_PUBLIC_TTS_URL || 'http://localhost:8001'

  try {
    console.info('[VectorRAG] Generating embedding for question:', text)
    const response = await fetch(`${embedUrl}/embeddings`, {
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
    let { data, error } = await supabase.rpc('search_curriculum', {
      query_embedding: embedding,
      similarity_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      console.error('[VectorRAG] Curriculum search error:', error)
      return []
    }

    if (!data?.length && threshold > -1) {
      console.warn('[VectorRAG] No chunks above threshold; retrying with threshold -1 for diagnostics')
      const retry = await supabase.rpc('search_curriculum', {
        query_embedding: embedding,
        similarity_threshold: -1,
        match_count: limit,
      })
      data = retry.data
      error = retry.error
      if (error) {
        console.error('[VectorRAG] Curriculum retry search error:', error)
        return []
      }
    }

    console.info(`[VectorRAG] Vector search found ${data?.length || 0} curriculum chunks for question:`, query, data)
    return data || []
  } catch (e) {
    console.error('[VectorRAG] Failed to search curriculum:', e)
    return []
  }
}
