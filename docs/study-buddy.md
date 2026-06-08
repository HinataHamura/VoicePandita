# Bondhu Study Room

**Implemented in main:** a feature-flagged v1 of Bondhu Study Room / AI Study Buddy Group.

Bondhu Study Room is a social learning flow, not an exam mode. Students who are confused about a similar concept can join a temporary 3-5 person room. The v1 host runs concept checks, hints, explanations, and a final summary without exposing real names, emails, phone numbers, or auth IDs.

## Enable Locally

Add these values to `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_STUDY_BUDDY=true
STUDY_BUDDY_MIN_MEMBERS=3
STUDY_BUDDY_MAX_MEMBERS=5
STUDY_BUDDY_WAIT_TIMEOUT_SECONDS=90
STUDY_BUDDY_ROOM_DURATION_MINUTES=10
```

Existing Supabase variables are reused:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

## Database

Run the migration:

```bash
supabase db push
```

Migration file:

```text
supabase/migrations/20260608152000_create_study_buddy_rooms.sql
```

It creates `study_rooms`, `study_room_members`, `study_room_messages`, `study_room_questions`, `study_room_answers`, and `study_room_reports` with indexes, updated-at trigger, and RLS policies.

## Privacy And Safety

- Room UI shows only aliases such as `Bondhu 1`.
- API responses do not expose emails, real names, auth IDs, or phone numbers.
- Important writes go through server route handlers.
- V1 does not include unrestricted student-to-student chat.
- Quick reactions and answer submission are allowed.
- Moderation helpers block phone numbers, emails, URLs, social handles, and basic abusive words.

## Routes

- `/study-buddy`
- `/study-buddy/[roomId]`
- `POST /api/study-buddy/join`
- `GET /api/study-buddy/room/[roomId]`
- `POST /api/study-buddy/room/[roomId]/start`
- `POST /api/study-buddy/room/[roomId]/answer`
- `POST /api/study-buddy/room/[roomId]/next`
- `POST /api/study-buddy/room/[roomId]/leave`
- `POST /api/study-buddy/room/[roomId]/report`
- `GET /api/study-buddy/my-active`

## Known Limitations

- Realtime channel scaffolding exists, but v1 room screen uses polling fallback so weak networks still work.
- Similar topic matching is practical keyword/topic-key matching; pgvector cluster matching can be added after production data is available.
- Solo AI practice is clearly labeled and never fakes human students.
