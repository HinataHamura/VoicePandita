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

type SearchProfile = {
  level?: string
  goal?: string
  group?: string
}

type SearchOptions = {
  subject?: string
  profile?: SearchProfile
  preferredSourceDataset?: string
}

function curriculumQueryText(query: string, options?: SearchOptions) {
  const profile = options?.profile
  return [
    query,
    options?.subject ? `Selected subject: ${options.subject}` : '',
    profile?.level ? `Student level: ${profile.level}` : '',
    profile?.goal ? `Learning goal: ${profile.goal}` : '',
    profile?.group ? `Study group: ${profile.group}` : '',
  ].filter(Boolean).join('\n')
}

export async function searchCurriculum(
  query: string,
  supabase: any,
  threshold = 0.5,
  limit = 3,
  options?: SearchOptions
) {
  try {
    const embedding = await generateEmbedding(curriculumQueryText(query, options))
    if (!embedding.length) {
      console.warn('[VectorRAG] No embedding generated for query')
      return []
    }

    const level = options?.profile?.level?.toLowerCase()
    const subject = options?.subject?.toLowerCase()
    const preferredSourceDataset = options?.preferredSourceDataset ||
      (level === 'ssc' ? 'ssc-banglatutor' : undefined)

    console.info('[VectorRAG] Calling Supabase RPC search_curriculum', {
      threshold,
      limit,
      level,
      subject,
      preferredSourceDataset,
    })
    let { data, error } = await supabase.rpc('search_curriculum', {
      query_embedding: embedding,
      similarity_threshold: threshold,
      match_count: limit,
      match_level: level || null,
      match_subject: subject || null,
      preferred_source_dataset: preferredSourceDataset || null,
    })

    if (error) {
      console.warn('[VectorRAG] Filtered curriculum search failed, retrying legacy RPC:', error)
      const legacy = await supabase.rpc('search_curriculum', {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: limit,
      })
      data = legacy.data
      error = legacy.error
      if (error) {
        console.error('[VectorRAG] Curriculum search error:', error)
        return []
      }
    }

    const cleanData = (data || []).filter((chunk: any) =>
      typeof chunk.content === 'string' &&
      !chunk.content.trim().toLowerCase().startsWith('student question:')
    ).map((chunk: any) => ({
      ...chunk,
      contextText: chunk.context_text || [chunk.contextual_summary, chunk.content].filter(Boolean).join('\n\n'),
    }))

    const preferred = subject
      ? cleanData.filter((chunk: any) => String(chunk.subject || '').toLowerCase() === subject)
      : []
    const fallback = subject
      ? cleanData.filter((chunk: any) => String(chunk.subject || '').toLowerCase() !== subject)
      : cleanData
    const rankedData = [...preferred, ...fallback].slice(0, limit)

    console.info(`[VectorRAG] Vector search found ${rankedData.length} curriculum chunks for question:`, query, rankedData)
    return rankedData
  } catch (e) {
    console.error('[VectorRAG] Failed to search curriculum:', e)
    return []
  }
}
