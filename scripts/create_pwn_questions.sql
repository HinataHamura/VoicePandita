-- Peer Wisdom Network vector store for anonymous student questions.
-- Run this in Supabase SQL Editor after pgvector is enabled.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pwn_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  embedding vector(384) NOT NULL,
  subject text NOT NULL DEFAULT 'unknown',
  topic text,
  cluster_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pwn_questions
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS embedding vector(384),
  ADD COLUMN IF NOT EXISTS subject text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS cluster_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE pwn_questions
SET
  question_text = COALESCE(question_text, ''),
  subject = COALESCE(subject, 'unknown'),
  cluster_id = COALESCE(cluster_id, gen_random_uuid()),
  created_at = COALESCE(created_at, now());

ALTER TABLE pwn_questions
  ALTER COLUMN question_text SET NOT NULL,
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN subject SET DEFAULT 'unknown',
  ALTER COLUMN cluster_id SET NOT NULL,
  ALTER COLUMN cluster_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS pwn_questions_embedding_hnsw_idx
  ON pwn_questions
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS pwn_questions_cluster_idx
  ON pwn_questions (cluster_id);

CREATE INDEX IF NOT EXISTS pwn_questions_subject_created_idx
  ON pwn_questions (subject, created_at DESC);

CREATE OR REPLACE FUNCTION search_pwn_questions(
  query_embedding vector(384),
  similarity_threshold float DEFAULT 0.82,
  match_count int DEFAULT 5,
  subject_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question_text text,
  subject text,
  topic text,
  cluster_id uuid,
  similarity float,
  created_at timestamptz
) AS $$
  SELECT
    pq.id,
    pq.question_text,
    pq.subject,
    pq.topic,
    pq.cluster_id,
    1 - (pq.embedding <=> query_embedding) AS similarity,
    pq.created_at
  FROM pwn_questions pq
  WHERE
    pq.embedding IS NOT NULL
    AND
    (subject_filter IS NULL OR pq.subject = subject_filter)
    AND 1 - (pq.embedding <=> query_embedding) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION pwn_hotspots(
  subject_filter text DEFAULT NULL,
  hotspot_count int DEFAULT 20
)
RETURNS TABLE (
  subject text,
  topic text,
  cluster_id uuid,
  question_count bigint,
  latest_question_at timestamptz
) AS $$
  WITH ranked AS (
    SELECT
      pq.*,
      row_number() OVER (PARTITION BY pq.cluster_id ORDER BY pq.created_at DESC) AS recency_rank
    FROM pwn_questions pq
    WHERE subject_filter IS NULL OR pq.subject = subject_filter
  ),
  grouped AS (
    SELECT
      r.cluster_id,
      max(r.subject) FILTER (WHERE r.recency_rank = 1) AS subject,
      max(r.topic) FILTER (WHERE r.recency_rank = 1) AS topic,
      count(*) AS question_count,
      max(r.created_at) AS latest_question_at
    FROM ranked r
    GROUP BY r.cluster_id
  )
  SELECT
    g.subject,
    g.topic,
    g.cluster_id,
    g.question_count,
    g.latest_question_at
  FROM grouped g
  ORDER BY g.question_count DESC, g.latest_question_at DESC
  LIMIT hotspot_count;
$$ LANGUAGE SQL STABLE;

SELECT 'pwn_questions table and search functions created successfully!' AS status;
