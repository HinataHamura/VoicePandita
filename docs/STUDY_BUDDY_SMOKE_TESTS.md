# VoicePandita Study Room - Smoke Test Checklist

## Overview
This checklist verifies core functionality after implementing production quality improvements to the Study Buddy feature. Test manually in a browser or via curl/Postman.

---

## Test 1: Join & Room Creation

**Scenario**: New student joins a topic for the first time

- [ ] POST `/api/study-buddy/join` with valid payload (questionText, optional subject/classLevel/language)
  - Expected: `{ roomId, status: 'waiting', memberCount: 1, minMembers, maxMembers, topicTitle, redirectUrl }`
  - Verify: `sessionId` NOT in response (security fix)
- [ ] GET `/api/study-buddy/room/{roomId}` 
  - Expected: Room state (members, questions, messages, answers)
  - Verify: No `sessionId` field in response
  - Verify: `members[0].display_alias` is diverse name (not "Bondhu 1")
  - Verify: User is marked as `active` member

---

## Test 2: Quiz Quality (Newton's Second Law)

**Scenario**: Join room with topic "Newton's Second Law"

- [ ] Room is created with quiz questions loaded
- [ ] Quiz has exactly 5 questions
- [ ] **At least one question** contains "F = ma" or "force = mass" text
- [ ] **At least one question** has a calculation (numbers with +/-/×/÷ or "a = F / m")
- [ ] **At least one question** mentions real-life example (গাড়ি/ঠেলাগাড়ি/ক্রিকেট/বল etc.)
- [ ] Difficulty distribution: ≥2 easy, ≥1 medium (check `question.difficulty`)
- [ ] Each question has `conceptTag` set (not vague)

**Scenario**: Generic topic without fallback

- [ ] Join room with topic "Random Science Concept"
- [ ] Verify fallback quiz is used (not weak AI-generated quiz)
- [ ] "concept-check 2,3,4,5" pattern is NOT present

---

## Test 3: Moderation - PII Detection

**Scenario**: Try to send messages with blocked content

- [ ] Message with BD phone (`01712345678`): **BLOCKED** with error response
- [ ] Message with email (`user@example.com`): **BLOCKED**
- [ ] Message with URL (`https://example.com`): **BLOCKED**
- [ ] Message with social handle (`facebook id: john`): **BLOCKED**
- [ ] Message with abuse word (`বোকা`): **BLOCKED**

**False Positives (Should PASS)**

- [ ] Message `"10x20"` (math, not URL): **ALLOWED**
- [ ] Message `"instagram post today"` (no colon, not handle): **ALLOWED**
- [ ] Message `"class 10"` (not email): **ALLOWED**

---

## Test 4: Moderation - Spam Detection

**Scenario**: Try to send spam messages

- [ ] Message `"aaaaaaa"` (4+ repeated chars): **BLOCKED**
- [ ] Message `"😂😂😂"` (emoji-only): **BLOCKED**
- [ ] Message `"HELP"` (short all-caps): **BLOCKED**
- [ ] Message `"12345"` (numbers only): **BLOCKED**

**Valid Messages (Should PASS)**

- [ ] Message `"Hello there!"`: **ALLOWED**
- [ ] Message `"HELLO, everyone!"` (sentence-length caps): **ALLOWED**
- [ ] Message `"Hi 👋"` (emoji mixed with text): **ALLOWED**

---

## Test 5: Rate Limiting

**Scenario**: Single student floods messages

- [ ] Send 1 message every 5 seconds × 8 = 8 messages in 60s: **ALLOWED**
- [ ] Send 9th message within 60s: **BLOCKED** (429 Too Many Requests)
- [ ] Wait 60s, send again: **ALLOWED**

**Room-wide rate limiting**

- [ ] Coordinate with test partner to send 15 messages to same room in 30s (multi-student spam)
  - Expected: Both clients blocked (429)
  - Message shows: "Room খুব busy, একটু অপেক্ষা করো।"

---

## Test 6: Answer Submission

**Scenario**: Student submits answer to a question

- [ ] POST `/api/study-buddy/room/{roomId}/answer` with `{questionId, answer: {id: 'A'}, responseMs: 5000}`
  - Expected: `{ isCorrect: true/false, answerId }`
- [ ] GET `/api/study-buddy/room/{roomId}` after submission
  - Verify: Answer appears in `answers` array
  - Verify: `is_correct` boolean is set
  - Verify: `response_ms` is recorded
- [ ] POST `/api/study-buddy/room/{roomId}/next`
  - Expected: Explanation message inserted
  - Expected: Explanation contains `next.explanation_bn`

---

## Test 7: Room Lifecycle (Auto-Start)

**Scenario**: Multiple students join until min_members reached

- [ ] Student 1 joins: room status = `'waiting'`, memberCount = 1
- [ ] Student 2 joins (assuming min = 3): status = `'waiting'`, memberCount = 2
- [ ] Student 3 joins: room status changes to **`'active'`**, started_at is set
- [ ] Verify quiz questions are loaded at this point

**Solo Start (Override Waiting)**

- [ ] Student joins alone: status = `'waiting'`
- [ ] Student calls POST `/api/study-buddy/room/{roomId}/start` with `{solo: true}`
  - Expected: room status = `'active'` (no min_members requirement)

---

## Test 8: Discussion During Waiting

**Scenario**: Message sent while room status is 'waiting'

- [ ] Student 1 joins room (waiting state)
- [ ] Student 1 sends message: "Hi, what's the topic?"
  - Expected: Message is **ALLOWED** (not disabled)
  - Expected: Message appears in room messages
  - Expected: Message contains no `sessionId`
- [ ] Other students see the message immediately

---

## Test 9: Audit Logging

**Scenario**: Check audit trail (backend check)

- [ ] Student joins: `study_room_session_audit` row with `action='joined'`
- [ ] Student reports room: row with `action='flagged'`
- [ ] Student leaves: row with `action='left'`
- [ ] All rows have correct `room_id`, `anonymous_session_id`, `created_at`

*Note: Requires direct database query or admin API*

---

## Test 10: Demo Mode

**Scenario**: Access study room with `?demo=1` query parameter

- [ ] GET `/api/study-buddy/room/{roomId}?demo=1&topic=Newton's%20Second%20Law`
  - Expected: Response includes room/members/questions/messages/answers (no DB required)
  - Expected: Supabase is **NOT** queried (fails gracefully)
- [ ] Page loads and functions without errors

---

## Test 11: Error Handling

**Scenario**: Test fallback and error paths

- [ ] Supabase connection fails: Room creation falls back to demo mode ✓
- [ ] Gemini API fails: Quiz generation uses fallback questions ✓
- [ ] Invalid room ID: 404 response
- [ ] Non-member accessing room: 404 response
- [ ] Database not migrated: 503 with message about `supabase db push`

---

## Test 12: Pseudo-Random Anonymity

**Scenario**: Check alias diversity

- [ ] Student 1 joins same room: alias = "Smart Red" (or similar color/adjective pair)
- [ ] Student 2 joins same room: alias = "Curious Blue" (different from Student 1)
- [ ] Student 1 refreshes page & rejoins: alias = "Smart Red" (deterministic, same as before)
- [ ] Student 3 joins different room: can have same alias as Student 1 (hash is room+session specific)

---

## Test 13: Emoji Reactions

**Scenario**: Send emoji reactions via QuickReactionBar

- [ ] Click emoji button (`👍`): Message posted with emoji character
- [ ] Other students see emoji reaction immediately
- [ ] Emoji passes moderation (not flagged as abuse)

---

## Environment Setup

```bash
# Run local dev server
npm run dev

# Test with curl (example join):
curl -X POST http://localhost:3000/api/study-buddy/join \
  -H "Content-Type: application/json" \
  -b "vp_study_session_id=<uuid>" \
  -d '{"questionText": "Explain F=ma", "language": "bn"}'

# Test room fetch:
curl http://localhost:3000/api/study-buddy/room/{roomId} \
  -b "vp_study_session_id=<uuid>"
```

---

## Sign-Off

- [ ] All tests 1-13 passed
- [ ] No sessionId leaking in responses
- [ ] Moderation correctly blocks PII and abuse
- [ ] Quiz quality validates Newton's Law requirements
- [ ] Discussion works in waiting phase
- [ ] Alias diversity observed (not sequential numbers)
- [ ] Audit table has entries for joined/flagged/left actions

**Date**: _______________  
**Tester**: _______________  
**Notes**: _______________

