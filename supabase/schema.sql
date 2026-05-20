-- ═══════════════════════════════════════════════
-- VoicePandita — Supabase SQL Schema
-- Run in Supabase SQL Editor (supabase.com/dashboard)
-- ═══════════════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Students (auth.users linked) ──────────────
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  grade         TEXT CHECK (grade IN ('SSC','HSC','University','Graduate')),
  goal          TEXT,
  english_level TEXT CHECK (english_level IN ('weak','moderate','good')),
  language_pref TEXT DEFAULT 'bn',
  weak_topics   TEXT[] DEFAULT '{}',
  skill_dna     JSONB DEFAULT '{}',
  streak_days   INT  DEFAULT 0,
  last_active   TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Anonymous sessions (no PII) ───────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anonymous_session_id  UUID NOT NULL,
  subject               TEXT NOT NULL,
  question_text         TEXT NOT NULL,
  answer_text           TEXT,
  emotion_state         TEXT CHECK (emotion_state IN ('confident','confused','frustrated')),
  language              TEXT DEFAULT 'bn',
  output_mode           TEXT DEFAULT 'whiteboard',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Curriculum embeddings (RAG) ───────────────
CREATE TABLE IF NOT EXISTS curriculum_embeddings (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content   TEXT NOT NULL,
  subject   TEXT NOT NULL,
  chapter   TEXT,
  topic     TEXT,
  embedding VECTOR(384),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS curriculum_embeddings_hnsw
  ON curriculum_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── PWN: anonymized question embeddings ───────
CREATE TABLE IF NOT EXISTS pwn_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  embedding   VECTOR(384),
  cluster_id  UUID,
  subject     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pwn_questions_hnsw
  ON pwn_questions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── PWN: confusion hotspot clusters ───────────
CREATE TABLE IF NOT EXISTS pwn_clusters (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centroid         VECTOR(384),
  hotspot_count    INT DEFAULT 0,
  subject          TEXT,
  topic_label      TEXT,
  clarification    TEXT,
  last_updated     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Error logs ────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint    TEXT,
  error_msg   TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════
ALTER TABLE students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwn_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwn_clusters         ENABLE ROW LEVEL SECURITY;

-- Students: only own row
CREATE POLICY "Students see own row" ON students
  FOR ALL USING (auth.uid() = auth_user_id);

-- Sessions: anon read (no PII stored)
CREATE POLICY "Sessions insert anon" ON sessions
  FOR INSERT WITH CHECK (true);

-- Curriculum: public read
CREATE POLICY "Curriculum public read" ON curriculum_embeddings
  FOR SELECT USING (true);

-- PWN clusters: public read
CREATE POLICY "PWN clusters public read" ON pwn_clusters
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════
-- pgvector similarity search function
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION match_curriculum(
  query_embedding VECTOR(384),
  match_subject   TEXT,
  match_count     INT DEFAULT 3
)
RETURNS TABLE (
  id        UUID,
  content   TEXT,
  subject   TEXT,
  chapter   TEXT,
  topic     TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id, ce.content, ce.subject, ce.chapter, ce.topic,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM curriculum_embeddings ce
  WHERE ce.subject = match_subject
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
