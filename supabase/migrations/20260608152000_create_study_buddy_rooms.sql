CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.study_buddy_session_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'anonymous_session_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.study_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key text NOT NULL,
  topic_title text NOT NULL,
  subject text,
  class_level text,
  language text DEFAULT 'bn',
  source_question text,
  source_question_hash text,
  room_status text NOT NULL DEFAULT 'waiting' CHECK (room_status IN ('waiting', 'active', 'completed', 'cancelled', 'expired')),
  max_members int DEFAULT 5,
  min_members int DEFAULT 3,
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_by_session_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  anonymous_session_id uuid NOT NULL,
  display_alias text NOT NULL,
  avatar_seed text,
  joined_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  left_at timestamptz,
  member_status text DEFAULT 'active' CHECK (member_status IN ('active', 'left', 'kicked', 'idle')),
  UNIQUE(room_id, anonymous_session_id)
);

CREATE TABLE IF NOT EXISTS public.study_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('ai_host', 'student', 'system')),
  sender_session_id uuid,
  message_type text NOT NULL CHECK (message_type IN ('text', 'question', 'explanation', 'system', 'result')),
  content text NOT NULL,
  safe_content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_room_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  question_order int NOT NULL,
  question_type text DEFAULT 'mcq',
  prompt_bn text NOT NULL,
  options jsonb NOT NULL,
  correct_answer jsonb NOT NULL,
  hint_bn text,
  explanation_bn text NOT NULL,
  difficulty text DEFAULT 'easy',
  concept_tag text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_room_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.study_room_questions(id) ON DELETE CASCADE,
  anonymous_session_id uuid NOT NULL,
  answer jsonb NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  response_ms int,
  answered_at timestamptz DEFAULT now(),
  UNIQUE(question_id, anonymous_session_id)
);

CREATE TABLE IF NOT EXISTS public.study_room_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  reporter_session_id uuid NOT NULL,
  reported_session_id uuid,
  reason text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_rooms_topic_status_expires_idx ON public.study_rooms(topic_key, room_status, expires_at);
CREATE INDEX IF NOT EXISTS study_room_members_room_session_idx ON public.study_room_members(room_id, anonymous_session_id);
CREATE INDEX IF NOT EXISTS study_room_messages_room_created_idx ON public.study_room_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS study_room_questions_room_order_idx ON public.study_room_questions(room_id, question_order);
CREATE INDEX IF NOT EXISTS study_room_answers_room_question_idx ON public.study_room_answers(room_id, question_id);

DROP TRIGGER IF EXISTS study_rooms_updated_at ON public.study_rooms;
CREATE TRIGGER study_rooms_updated_at
BEFORE UPDATE ON public.study_rooms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_room_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_room_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_room_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study room members can read their rooms"
ON public.study_rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.study_room_members m
    WHERE m.room_id = study_rooms.id
      AND m.anonymous_session_id = public.study_buddy_session_id()
      AND m.member_status IN ('active', 'idle')
  )
);

CREATE POLICY "study room members can read aliases"
ON public.study_room_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.study_room_members mine
    WHERE mine.room_id = study_room_members.room_id
      AND mine.anonymous_session_id = public.study_buddy_session_id()
      AND mine.member_status IN ('active', 'idle')
  )
);

CREATE POLICY "study room members can read messages"
ON public.study_room_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.study_room_members mine
    WHERE mine.room_id = study_room_messages.room_id
      AND mine.anonymous_session_id = public.study_buddy_session_id()
      AND mine.member_status IN ('active', 'idle')
  )
);

CREATE POLICY "study room members can read questions"
ON public.study_room_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.study_room_members mine
    WHERE mine.room_id = study_room_questions.room_id
      AND mine.anonymous_session_id = public.study_buddy_session_id()
      AND mine.member_status IN ('active', 'idle')
  )
);

CREATE POLICY "study room members can read safe answer aggregates"
ON public.study_room_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.study_room_members mine
    WHERE mine.room_id = study_room_answers.room_id
      AND mine.anonymous_session_id = public.study_buddy_session_id()
      AND mine.member_status IN ('active', 'idle')
  )
);

CREATE POLICY "students can insert own answer"
ON public.study_room_answers FOR INSERT
WITH CHECK (anonymous_session_id = public.study_buddy_session_id());

CREATE POLICY "students can report from own session"
ON public.study_room_reports FOR INSERT
WITH CHECK (reporter_session_id = public.study_buddy_session_id());
