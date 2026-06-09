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
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'curriculum',
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS source_dataset text,
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS answer_text text,
  ADD COLUMN IF NOT EXISTS correct_answer text,
  ADD COLUMN IF NOT EXISTS distractor_answers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hints jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS convergence jsonb,
  ADD COLUMN IF NOT EXISTS topic_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS curriculum_embeddings_level_subject_idx
  ON curriculum_embeddings (level, subject);

CREATE INDEX IF NOT EXISTS curriculum_embeddings_source_dataset_idx
  ON curriculum_embeddings (source_dataset);

-- Older seed data used coarse source_doc_id values like subject::chapter::topic,
-- so multiple rows can share the same id. Make those ids unique before adding
-- the production upsert index; this preserves all existing rows.
WITH duplicate_source_docs AS (
  SELECT
    id,
    source_doc_id,
    row_number() OVER (
      PARTITION BY source_doc_id
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_rank
  FROM curriculum_embeddings
  WHERE source_doc_id IS NOT NULL
)
UPDATE curriculum_embeddings ce
SET source_doc_id = duplicate_source_docs.source_doc_id || ':legacy-' || duplicate_source_docs.duplicate_rank
FROM duplicate_source_docs
WHERE ce.id = duplicate_source_docs.id
  AND duplicate_source_docs.duplicate_rank > 1;

DROP INDEX IF EXISTS curriculum_embeddings_source_doc_unique_idx;
CREATE UNIQUE INDEX curriculum_embeddings_source_doc_unique_idx
  ON curriculum_embeddings (source_doc_id);

DROP FUNCTION IF EXISTS search_curriculum(vector, double precision, integer);
DROP FUNCTION IF EXISTS search_curriculum(vector, double precision, integer, text, text, text);

CREATE OR REPLACE FUNCTION search_curriculum(
  query_embedding vector(384),
  similarity_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3,
  match_level text DEFAULT NULL,
  match_subject text DEFAULT NULL,
  preferred_source_dataset text DEFAULT NULL
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
  level text,
  source_dataset text,
  question_text text,
  answer_text text,
  correct_answer text,
  distractor_answers jsonb,
  hints jsonb,
  convergence jsonb,
  topic_tags text[],
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
    level,
    source_dataset,
    question_text,
    answer_text,
    correct_answer,
    distractor_answers,
    hints,
    convergence,
    topic_tags,
    1 - (embedding <=> query_embedding) as similarity
  FROM curriculum_embeddings
  WHERE
    1 - (embedding <=> query_embedding) > similarity_threshold
    AND lower(trim(content)) NOT LIKE 'student question:%'
    AND coalesce(source_type, 'curriculum') = 'curriculum'
    AND (match_level IS NULL OR level IS NULL OR lower(level) = lower(match_level))
    AND (match_subject IS NULL OR subject IS NULL OR lower(subject) = lower(match_subject))
  ORDER BY
    CASE
      WHEN preferred_source_dataset IS NOT NULL AND lower(coalesce(source_dataset, '')) = lower(preferred_source_dataset) THEN 0
      ELSE 1
    END,
    similarity DESC
  LIMIT match_count;
$$ LANGUAGE SQL STABLE;

-- Verify function was created
SELECT 'contextual search_curriculum function created successfully!' as status;
