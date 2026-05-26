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

-- Chat history: authenticated cloud learning memory
CREATE TABLE IF NOT EXISTS chat_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'New learning chat',
  subject      TEXT,
  output_mode  TEXT DEFAULT 'whiteboard',
  last_message TEXT,
  message_count INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  emotion     TEXT CHECK (emotion IN ('confident','confused','frustrated')),
  diagram     TEXT,
  graph_path  TEXT[],
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
  ON chat_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
  ON chat_messages (session_id, created_at ASC);

CREATE OR REPLACE FUNCTION increment_chat_message_count()
RETURNS trigger AS $$
BEGIN
  UPDATE chat_sessions
  SET
    message_count = message_count + 1,
    updated_at = COALESCE(NEW.created_at, NOW())
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_messages_increment_count ON chat_messages;
CREATE TRIGGER chat_messages_increment_count
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION increment_chat_message_count();

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
  normalized_question TEXT,
  question_text TEXT,
  embedding   VECTOR(384),
  cluster_id  UUID,
  subject     TEXT,
  concept     TEXT,
  topic       TEXT,
  total_asks  INT DEFAULT 1,
  last_asked_at TIMESTAMPTZ DEFAULT NOW(),
  top_keywords TEXT[] DEFAULT '{}',
  sample_questions TEXT[] DEFAULT '{}',
  emotion_pattern TEXT DEFAULT 'mixed',
  session_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pwn_questions
  ADD COLUMN IF NOT EXISTS normalized_question TEXT,
  ADD COLUMN IF NOT EXISTS question_text TEXT,
  ADD COLUMN IF NOT EXISTS concept TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS total_asks INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_asked_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS top_keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sample_questions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emotion_pattern TEXT DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS pwn_questions_hnsw
  ON pwn_questions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE UNIQUE INDEX IF NOT EXISTS pwn_questions_normalized_subject_idx
  ON pwn_questions (subject, normalized_question)
  WHERE normalized_question IS NOT NULL;

CREATE INDEX IF NOT EXISTS pwn_questions_trending_idx
  ON pwn_questions (total_asks DESC, last_asked_at DESC);

CREATE TABLE IF NOT EXISTS pwn_insights (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id       UUID REFERENCES pwn_questions(id) ON DELETE CASCADE,
  common_confusion  TEXT,
  best_explanation  TEXT,
  top_keywords      TEXT[] DEFAULT '{}',
  emotion_pattern   TEXT DEFAULT 'mixed',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pwn_insights_question_idx
  ON pwn_insights (question_id);

CREATE UNIQUE INDEX IF NOT EXISTS pwn_insights_question_unique_idx
  ON pwn_insights (question_id);

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
ALTER TABLE chat_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwn_insights         ENABLE ROW LEVEL SECURITY;

-- Students: only own row
CREATE POLICY "Students see own row" ON students
  FOR ALL USING (auth.uid() = auth_user_id);

-- Sessions: anon read (no PII stored)
CREATE POLICY "Sessions insert anon" ON sessions
  FOR INSERT WITH CHECK (true);

-- Chat history: authenticated users can only access their own sessions/messages.
CREATE POLICY "Chat sessions own rows" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Chat messages own session rows" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

-- Curriculum: public read
CREATE POLICY "Curriculum public read" ON curriculum_embeddings
  FOR SELECT USING (true);

-- PWN clusters: public read
CREATE POLICY "PWN clusters public read" ON pwn_clusters
  FOR SELECT USING (true);

CREATE POLICY "PWN questions public read aggregate" ON pwn_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "PWN questions anon insert" ON pwn_questions;
DROP POLICY IF EXISTS "PWN questions anon update aggregate" ON pwn_questions;

CREATE POLICY "PWN insights public read" ON pwn_insights
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
