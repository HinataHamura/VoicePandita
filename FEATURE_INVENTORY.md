# VoicePandita Feature Inventory

Last updated: 2026-06-11

This document summarizes the major features currently added to VoicePandita, including the user-facing routes, API routes, and supporting modules.

## Product Overview

VoicePandita is a Bangladesh-first AI learning companion focused on:

- Bangla-first tutoring for SSC/HSC/admission learners.
- Voice, text, image, and PDF-based learning input.
- Curriculum-grounded answers with graph/vector retrieval support.
- Student memory, progress analytics, and next-step recommendations.
- Inclusive learning support for low-resource languages and deaf learners through BdSL avatar playback.
- Peer and group-learning flows through Peer Wisdom Network and Bondhu Study Room.

## Main Navigation

The primary app navigation is defined in `src/components/Sidebar.tsx`.

Current routes include:

- `/` - Home / product overview.
- `/learn` - Main AI tutor.
- `/voice-practice` - Spoken answer practice and grading.
- `/answer-checker` - Handwritten answer checking.
- `/history` - Saved Q&A history.
- `/profile` - Student profile dashboard.
- `/progress` - Student analytics dashboard.
- `/study-buddy` - Bondhu Study Room entry point.
- `/pwn` - Peer Wisdom Network.
- `/chakma` - Language bridge.
- `/settings` - User preferences.
- `/pdf-summary` - PDF study summary tool.

Protected routes are controlled by `src/middleware.ts`.

## Authentication And Student Identity

Implemented files:

- `src/app/login/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/student-path/page.tsx`
- `src/lib/authFlow.ts`
- `src/lib/studentStore.ts`
- `src/middleware.ts`

Capabilities:

- Supabase auth support when Supabase env vars are configured.
- Demo login flow.
- Guest/local student session flow.
- Protected routes for learning, history, profile, progress, practice tools, and Bondhu Study Room.
- Student profile storage for level, goal, and group.
- Per-student local storage keys for progress, concept memory, chat history, voice practice, and handwritten checks.

## Learn Page / AI Tutor

Implemented file:

- `src/app/learn/page.tsx`

Main capabilities:

- Bangla text question input.
- Voice question input using browser speech recognition and `/api/transcribe` fallback.
- Image upload / scan workflow for textbook or question images.
- OCR review flow before asking the tutor.
- Subject selector.
- Output mode selector:
  - Whiteboard/text style answer.
  - Simple explanation.
  - Exam mode.
  - Animation mode.
  - Video/Manim mode.
- Language preference:
  - Bangla.
  - Chakma.
  - Marma.
  - Garo.
- Deaf learner mode with BdSL avatar.
- Emotion-aware response badges.
- Voice output / browser speech synthesis.
- Offline banner and offline search fallback.
- Study Buddy invitation from confusing answers.
- History sync with local/Supabase chat sessions.
- Graph memory write attempts to Neo4j through `/api/graph-memory`.

Related APIs:

- `src/app/api/ask/route.ts`
- `src/app/api/ocr/route.ts`
- `src/app/api/transcribe/route.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/graph-memory/route.ts`
- `src/app/api/curriculum-memory/route.ts`

## Curriculum Retrieval And GraphRAG

Implemented files:

- `src/app/api/ask/route.ts`
- `src/lib/embeddings.ts`
- `src/lib/offline-search.ts`
- `src/app/api/graph-memory/route.ts`
- `VECTOR_SEARCH_GUIDE.md`
- `VECTOR_SEARCH_QUICK_START.md`

Capabilities:

- Curriculum-aware answer generation.
- Supabase pgvector retrieval support.
- Dynamic graph path planning for concepts.
- Neo4j graph memory writes when configured.
- Offline cached curriculum fallback.
- Grounding labels and provenance metadata in AI responses.

## OCR And Image-Based Learning

Implemented files:

- `src/app/learn/page.tsx`
- `src/app/api/ocr/route.ts`

Capabilities:

- Image upload from Learn page.
- Client-side image optimization before OCR.
- Gemini OCR extraction with retry and friendly quota/model errors.
- Manual OCR review/edit UI.
- OCR context sent into tutoring flow.
- Fallback handling when OCR quota/model is unavailable.

## PDF Summary

Implemented files:

- `src/app/pdf-summary/page.tsx`
- `src/app/api/pdf-summary/route.ts`
- `src/lib/pdfSummary.ts`

Capabilities:

- Upload text-based PDFs.
- File validation:
  - PDF only.
  - Max size/page limits.
  - Scanned PDF detection.
- Extract PDF text.
- Generate Bangla summary, key points, terms, formulas, and exam-style study notes.
- Gemini summary when available.
- Local fallback summary when quota/model fails.
- Download/copy style study output.

## BdSL Avatar And SignML Playback

Implemented files:

- `src/components/BdslAvatar.tsx`
- `src/app/api/bdsl-translate/route.ts`
- `public/data/Sections/dataset.json`
- `public/cwasa/*`

Capabilities:

- Deaf learner mode from Learn page.
- Tokenizes AI answer text into signable concepts.
- Loads IsharaKotha/BdSL SignML datasets.
- Matches Bangla and English words to known signs.
- Plays SignML through CWASA avatar when available.
- Falls back to local 3D hand-rig motion when needed.
- Shows match stats:
  - Total tokens.
  - Matched signs.
  - With SignML.
  - AI resolved.
  - Fingerspell fallback.
- Agentic missing-word resolver:
  - Unknown words are sent to `/api/bdsl-translate`.
  - Gemini/Groq suggests sign-dictionary lookup candidates.
  - Server validates candidates against the local SignML dataset.
  - Client marks recovered tokens as `AI resolved sign`.

Current limitation:

- This is text-to-sign playback, not reverse sign-language recognition from uploaded videos.

## Voice Practice

Implemented files:

- `src/app/voice-practice/page.tsx`
- `src/app/api/voice-practice/route.ts`
- `src/app/api/transcribe/route.ts`

Capabilities:

- Logged-in/protected practice page.
- Per-student practice history.
- Student selects subject and topic.
- AI generates a short practice question.
- Student answers by speaking or typing.
- Browser speech recognition when available.
- Audio recording and transcription fallback.
- AI grades the answer.
- Feedback includes:
  - Score.
  - Verdict.
  - Missing points.
  - Model answer.
  - Next step.
- Topic-level learning trace.
- Question-type coverage.
- Often-missing points.
- Data feeds into Student Analytics.

## Handwritten Answer Checker

Implemented files:

- `src/app/answer-checker/page.tsx`
- `src/app/api/handwritten-check/route.ts`

Capabilities:

- Logged-in/protected checker page.
- Per-student handwritten check history.
- Student uploads handwritten answer image.
- Optional question prompt and rubric/model answer.
- Max marks configuration.
- Gemini vision/OCR-based answer extraction.
- AI grading and feedback.
- Feedback includes:
  - Marks awarded.
  - Percentage.
  - Verdict.
  - Content feedback.
  - Writing feedback.
  - Strengths.
  - Missing points.
  - Improvement plan.
  - Model answer.
- Recent checks list.
- Data feeds into Student Analytics.

## Student Analytics Dashboard

Implemented file:

- `src/app/progress/page.tsx`

Capabilities:

- Protected student analytics route.
- Reads:
  - Student progress.
  - Chat history.
  - Concept memory.
  - Voice practice results.
  - Handwritten answer checks.
- Learning pulse cards:
  - Concepts touched.
  - Clear.
  - Improving.
  - Need support.
  - Mood.
- Understanding map by concept/topic.
- Confusion reduction view.
- Teach-back score.
- Visual learning activity:
  - Diagrams.
  - Animations/videos.
  - Voice explanations.
  - Photo explanations.
- Learning independence stage.
- Where to Improve overview:
  - Voice practice average.
  - Written answer average.
  - Repeated missing points.
  - Brief improvement plan.
  - Links to Voice Practice and Answer Checker.
- Next best steps linking back to Learn.

## History And Student Memory

Implemented files:

- `src/app/history/page.tsx`
- `src/hooks/useChatHistory.ts`
- `src/lib/services/chatHistory.ts`
- `src/lib/studentStore.ts`

Capabilities:

- Saved Q&A sessions.
- Supabase chat session support.
- Local history fallback.
- Pending sync queue for offline conditions.
- Session restore through `/learn?session=...`.
- Chat title generation from first question.
- Student concept memory and graph path storage.

## Profile And Onboarding

Implemented files:

- `src/app/profile/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/student-path/page.tsx`

Capabilities:

- Student profile setup.
- Student track and goal display.
- Quick actions to Learn, Analytics, and Peer Wisdom.
- Student-path selection for:
  - General learner.
  - Ethnic/low-resource learner.
  - Deaf learner.

## Peer Wisdom Network

Implemented files:

- `src/app/pwn/page.tsx`
- `src/app/api/pwn/route.ts`
- `src/hooks/usePWNInsights.ts`

Capabilities:

- Anonymized community learning intelligence.
- Stores or skips PWN writes depending on backend configuration.
- Finds confusion hotspots.
- Subject-level filtering.
- Trending/common question insights.
- Links hotspots back into Learn.

## Low-Resource Language Bridge

Implemented files:

- `src/app/chakma/page.tsx`
- `src/lib/chakmaBridge.ts`
- `src/lib/marmaBridge.ts`
- `src/lib/multilingual/*`

Capabilities:

- Bangla/English bridge support for Chakma, Marma, and Garo workflows.
- Language detection helpers.
- Localized answer support.
- Fallback message when verified data is limited.
- Romanized low-resource output warnings.

## Bondhu Study Room

Implemented files:

- `src/app/study-buddy/page.tsx`
- `src/app/study-buddy/[roomId]/page.tsx`
- `src/app/api/study-buddy/join/route.ts`
- `src/app/api/study-buddy/room/[roomId]/route.ts`
- `src/app/api/study-buddy/room/[roomId]/answer/route.ts`
- `src/app/api/study-buddy/room/[roomId]/next/route.ts`
- `src/app/api/study-buddy/room/[roomId]/report/route.ts`
- `src/app/api/study-buddy/room/[roomId]/leave/route.ts`
- `src/app/api/study-buddy/my-active/route.ts`
- `src/components/study-buddy/*`
- `src/hooks/useStudyBuddyJoin.ts`
- `src/hooks/useStudyRoom.ts`
- `src/hooks/useStudyRoomRealtime.ts`
- `src/hooks/useStudyRoomPresence.ts`
- `src/lib/study-buddy/*`
- `docs/study-buddy.md`

Capabilities:

- Logged-in/protected entry page.
- Create or join a safe study room by:
  - Question/confusion text.
  - Subject.
  - Class level.
  - Language.
  - Concept hint.
- Topic derivation and matching.
- Supabase-backed matching when configured.
- Demo/local room fallback when Supabase admin config is missing.
- AI-generated five-question concept quiz.
- Room states:
  - Waiting.
  - Active.
  - Completed.
  - Cancelled/expired support in types.
- AI host messages.
- MCQ concept checks.
- Hint reveal.
- Correct/incorrect answer reveal.
- Explanation after answering.
- Progress bar.
- Participation board.
- Child-safe no-free-chat design.
- Quick reaction bar.
- Report flow.
- Final room summary with score and weak concepts.
- Self-healing API behavior:
  - If an active/waiting room has no quiz questions, the room API generates and inserts them before returning data.
- Feature flag:
  - Enabled by default.
  - Can be disabled with `NEXT_PUBLIC_ENABLE_STUDY_BUDDY=false`.

## Visual Learning And Animations

Implemented files:

- `src/components/MermaidDiagram.tsx`
- `src/components/animations/*`
- `src/app/api/ask/route.ts`

Capabilities:

- Mermaid concept diagrams.
- Visual teaching animations.
- Manim video explainer component.
- Animation registry for known concepts:
  - Newton's Second Law.
  - Photosynthesis.
  - Minerals.
  - Quadratic Formula.
  - Generic concept animation.
- Output modes in Learn page connect to these visual experiences.

## Offline And Resilience Features

Implemented files:

- `src/lib/network.ts`
- `src/lib/offline-search.ts`
- `docs/offline-roadmap.md`
- `src/lib/services/chatHistory.ts`

Capabilities:

- Network status detection.
- Offline banner in Learn.
- Local offline search fallback.
- Local chat/history storage.
- Pending history sync queue.
- Graceful skip messages for missing Supabase/Neo4j/PWN config.
- Local PDF summary fallback.
- Local Study Buddy demo fallback when Supabase admin is unavailable.

## Settings

Implemented file:

- `src/app/settings/page.tsx`

Capabilities:

- Student-facing preferences page.
- Settings support used by voice output and app preferences.

## Documentation And Admin Docs

Implemented files:

- `src/app/docs/admin/*`
- `src/components/docs/DocsClient.tsx`
- `src/app/api/docs-live/route.ts`
- `src/lib/docs/*`
- `docs/*`

Capabilities:

- Editable/live project documentation.
- Pitch and product narrative content.
- Architecture and feature tables.
- Export-oriented docs UI.
- MCP documentation and AI-DLC notes.

## MCP And Data Tooling

Implemented files:

- `docs/MCP.md`
- `mcp/*`

Capabilities:

- MCP documentation for VoicePandita data and RAG inspection.
- Dataset inventory.
- Data provenance reports.
- BdSL/IsharaKotha asset coverage report.

## Current Known Gaps / Next Features

Possible next additions:

- Deaf learner video-answer upload:
  - Upload/record signed answer video.
  - Sample frames.
  - Multimodal AI interpretation.
  - Compare interpreted answer to expected answer.
  - Feed score into Student Analytics.
- Stronger BdSL recognition:
  - Requires sign-language video dataset and pose/hand landmark model.
- Better live Study Buddy realtime:
  - Current hook exists, but polling is still the main room refresh flow.
- Full backend migrations check:
  - Study Buddy live rooms require Supabase tables and service role config.
- More rigorous build/test coverage for recent feature additions.

