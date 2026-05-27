-- Create schema + function for contextual RAG vector search on curriculum.
-- Supports:
-- 1) Contextual RAG: each chunk can store generated context in contextual_summary.
-- 2) Variable / semantic chunking: chunks store source_doc_id, chunk_index, chunk_type, token_count.

ALTER TABLE curriculum_embeddings
  ADD COLUMN IF NOT EXISTS contextual_summary text,
  ADD COLUMN IF NOT EXISTS source_doc_id text,
  ADD COLUMN IF NOT EXISTS chunk_index int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunk_type text DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS token_count int,
  ADD COLUMN IF NOT EXISTS embedding_text text,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'curriculum';

DROP FUNCTION IF EXISTS search_curriculum(vector, double precision, integer);

CREATE OR REPLACE FUNCTION search_curriculum(
  query_embedding vector(384),
  similarity_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  content text,
  contextual_summary text,
  context_text text,
  subject text,
  chapter text,
  topic text,
  source_doc_id text,
  chunk_index int,
  chunk_type text,
  similarity float
) AS $$
  SELECT
    id,
    content,
    contextual_summary,
    concat_ws(E'\n\n', contextual_summary, content) as context_text,
    subject,
    chapter,
    topic,
    source_doc_id,
    chunk_index,
    chunk_type,
    1 - (embedding <=> query_embedding) as similarity
  FROM curriculum_embeddings
  WHERE
    1 - (embedding <=> query_embedding) > similarity_threshold
    AND lower(trim(content)) NOT LIKE 'student question:%'
    AND coalesce(source_type, 'curriculum') = 'curriculum'
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE SQL STABLE;

-- Verify function was created
SELECT 'contextual search_curriculum function created successfully!' as status;
