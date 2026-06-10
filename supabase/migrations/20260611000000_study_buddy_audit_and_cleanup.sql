-- Audit table for tracking session actions in study rooms
CREATE TABLE IF NOT EXISTS public.study_room_session_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  anonymous_session_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('joined', 'left', 'flagged')),
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_room_session_audit_room_created_idx ON public.study_room_session_audit(room_id, created_at);
CREATE INDEX IF NOT EXISTS study_room_session_audit_session_created_idx ON public.study_room_session_audit(anonymous_session_id, created_at);

-- RLS: Admin-only access
ALTER TABLE public.study_room_session_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit table is admin-only"
ON public.study_room_session_audit FOR SELECT
USING (false);

CREATE POLICY "audit table insert only via backend"
ON public.study_room_session_audit FOR INSERT
WITH CHECK (false);
