-- VoicePandita cloud memory migration.
-- Run this in Supabase SQL Editor after the base schema.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New learning chat',
  subject text,
  output_mode text DEFAULT 'whiteboard',
  last_message text,
  message_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  emotion text CHECK (emotion IN ('confident','confused','frustrated')),
  diagram text,
  graph_path text[],
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
  ON chat_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
  ON chat_messages (session_id, created_at ASC);

CREATE OR REPLACE FUNCTION increment_chat_message_count()
RETURNS trigger AS $$
BEGIN
  UPDATE chat_sessions
  SET message_count = message_count + 1,
      updated_at = COALESCE(NEW.created_at, now())
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_messages_increment_count ON chat_messages;
CREATE TRIGGER chat_messages_increment_count
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION increment_chat_message_count();

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat sessions own rows" ON chat_sessions;
CREATE POLICY "Chat sessions own rows" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Chat messages own session rows" ON chat_messages;
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

ALTER TABLE pwn_questions
  ADD COLUMN IF NOT EXISTS normalized_question text,
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS concept text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS total_asks int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_asked_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS top_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sample_questions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emotion_pattern text DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS pwn_questions_normalized_subject_idx
  ON pwn_questions (subject, normalized_question)
  WHERE normalized_question IS NOT NULL;

CREATE INDEX IF NOT EXISTS pwn_questions_trending_idx
  ON pwn_questions (total_asks DESC, last_asked_at DESC);

CREATE TABLE IF NOT EXISTS pwn_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES pwn_questions(id) ON DELETE CASCADE,
  common_confusion text,
  best_explanation text,
  top_keywords text[] DEFAULT '{}',
  emotion_pattern text DEFAULT 'mixed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pwn_insights_question_unique_idx
  ON pwn_insights (question_id);

ALTER TABLE pwn_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwn_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PWN questions public read aggregate" ON pwn_questions;
CREATE POLICY "PWN questions public read aggregate" ON pwn_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "PWN insights public read" ON pwn_insights;
CREATE POLICY "PWN insights public read" ON pwn_insights
  FOR SELECT USING (true);
