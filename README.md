# VoicePandita

Bangladesh-first voice and visual AI tutor for SSC/HSC/admission learners. The current app includes Bangla tutoring, voice input, OCR question capture, concept maps, teaching animations, student memory, Peer Wisdom Network hotspots, Supabase vector search, and Neo4j graph-memory writes.

This README reflects the current `main` branch plus the ethnic-language work that exists on the `my-feature` branch.

## Current Feature Set

### Student Learning App

- Landing page with product overview and learning flow.
- Supabase email/password auth plus judge/demo account flow.
- Protected student routes through Next.js middleware.
- Student onboarding for level, goal, and study group.
- Student path chooser for Bangla visual learning, ethnic language bridge, and BdSL mode.
- Student profile/progress preferences use local device state where needed, while chat history, concept memory, and Peer Wisdom Network data are stored in Supabase and fetched back from Supabase-backed APIs.
- Settings page for local language/display/sound/offline preferences.

### Main Learn Page

- Text question input.
- Bangla browser speech recognition when available.
- MediaRecorder fallback that sends audio to `/api/transcribe`.
- Image upload that sends textbook/handwritten question images to `/api/ocr`.
- Subject selector: Physics, Chemistry, Biology, Math, Bangla, English.
- Output modes: whiteboard concept map and visual teaching animation.
- Language modes: Bangla, Chakma, Marma, Garo.
- Deaf/BdSL mode toggle.
- Offline fallback answer packs when `navigator.onLine === false`.
- Browser `speechSynthesis` answer playback.

### AI Tutor / GraphRAG

- `/api/ask` is the main tutor endpoint.
- Hardcoded local curriculum graph for common concepts:
  - Newton's second law
  - Metallic bond
  - Ionic bond
  - Photosynthesis
  - Quadratic formula
  - Creative answer structure
- Gemini text generation when `GEMINI_API_KEY` is configured.
- Groq chat fallback when `GROQ_API_KEY` is configured.
- Local fallback answers when external LLMs are unavailable.
- Emotion adaptation using heuristic detection:
  - confident
  - confused
  - frustrated
- Mermaid concept diagram output.
- Animation key selection for visual teaching mode.
- Curriculum context can be passed from Supabase vector search.

### Visual Learning

- Mermaid concept map rendering with sanitization and fallback diagrams.
- Framer Motion teaching animations:
  - Newton's second law animation
  - Photosynthesis animation
  - Mineral concept animation
  - Generic dynamic concept animation
- `BdslAvatar` demo component that tokenizes answer text and shows animated sign-support UI.

### Voice, OCR, And TTS

- Groq Whisper STT through `/api/transcribe`.
- Gemini Vision OCR through `/api/ocr`.
- Browser SpeechSynthesis is the current TTS path.
- `/api/tts` exists as a fallback/stub endpoint and returns `{ fallback: true }`.
- Optional local Python FastAPI server supports:
  - `/tts`
  - `/embeddings`
  - `/health`

### Vector Search, Chat History, And Memory

- `/api/embeddings` calls the local Python embedding server when available.
- TypeScript deterministic 384-dimensional fallback embedding if Python server is unavailable.
- Supabase pgvector search through `search_curriculum`.
- `src/lib/embeddings.ts` searches curriculum context before asking the tutor.
- `/api/curriculum-memory` stores student Q&A memory into Supabase `curriculum_embeddings`.
- Chat/question memory is designed to be stored and retrieved through Supabase-backed memory tables/APIs rather than only staying on one browser.
- SQL scripts are included for contextual RAG columns and RPC setup.

### Peer Wisdom Network

- `/api/pwn` POST stores anonymous student questions with embeddings.
- `/api/pwn` GET returns common confusion hotspots.
- Supabase RPC `search_pwn_questions` is used for clustering similar questions.
- Fallback hotspot data is returned if Supabase admin env vars are missing.
- `/pwn` page displays hotspot topics, counts, clarifications, samples, and links back to Learn.

### Neo4j Graph Memory

- `/api/graph-memory` writes question, answer, and concept-path nodes into Neo4j.
- Creates/merges:
  - `Question`
  - `Answer`
  - `Concept`
  - `ANSWERED_BY`
  - `ABOUT`
  - `HAS_CHILD`
- Skips safely if Neo4j env vars are missing.
- Cypher helper scripts are included for constraints and caption cleanup.

### Ethnic Language Mode

Current `main` branch has:

- `/chakma` MELD language bridge demo page.
- Language options for Chakma, Marma, and Garo.
- `/learn` language selector with `bn`, `ckm`, `mrm`, and `gnk`.
- `/api/ask` accepts the selected language and can adapt cultural examples.

The `my-feature` branch adds deeper ethnic-language work:

- Local and Hugging Face backed Chakma bridge.
- Chakma script detection.
- Bangla-to-Chakma dataset-pair matching.
- Bangla-to-Chakma transliteration fallback.
- Marma/Myanmar script detection.
- Marma context examples from local JSONL or Hugging Face.
- Garo language hints/detection.
- Multilingual system prompt for Bangla, English, Chakma, Marma, and Garo.
- Instruction datasets for Bangla-to-Chakma, Bangla-to-Garo, Bangla-to-Marma, language detection, and combined multilingual training.
- LoRA/QLoRA fine-tuning script for multilingual model experiments.
- Text-only multilingual inference helper.

## Routes

| Route | Status | Description |
| --- | --- | --- |
| `/` | implemented | Landing/home page. |
| `/login` | implemented | Supabase login/signup and demo account. |
| `/onboarding` | implemented | 3-step student setup. |
| `/student-path` | implemented | Learner path selection after onboarding. |
| `/learn` | implemented | Main tutor interface. |
| `/history` | implemented | Local chat history. |
| `/profile` | implemented | Student dashboard. |
| `/progress` | implemented | Weak/strong topic progress. |
| `/pwn` | implemented | Peer Wisdom Network hotspots. |
| `/chakma` | implemented/demo | Ethnic language bridge demo. |
| `/settings` | implemented | Local preferences and logout. |

## API Routes

| API Route | Methods | Description |
| --- | --- | --- |
| `/api/ask` | POST | Main AI tutor endpoint. |
| `/api/transcribe` | POST | Groq Whisper audio transcription. |
| `/api/ocr` | POST | Gemini Vision OCR for question extraction. |
| `/api/tts` | POST | Stub endpoint; browser TTS is used. |
| `/api/embeddings` | POST | Local Python embeddings or TypeScript fallback embeddings. |
| `/api/curriculum-memory` | POST | Stores student Q&A memory in Supabase pgvector table. |
| `/api/graph-memory` | POST | Stores question/answer/concept graph in Neo4j. |
| `/api/pwn` | GET | Returns PWN hotspots. |
| `/api/pwn` | POST | Stores anonymous student question vectors. |

## Environment Variables

Create `.env.local` locally. Never commit real secrets.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_VISION_MODEL=

GROQ_API_KEY=
GROQ_MODEL=

NEXT_PUBLIC_TTS_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
NEO4J_DATABASE=
```

Python local server also supports:

```env
USE_HF_EMBEDDINGS=1
```

The `my-feature` branch ethnic-language utilities also reference:

```env
CHAKMA_DATASET_MAX_ROWS=
CHAKMA_DATASET_REMOTE_REFRESH=
VP_BASE_MODEL=
VP_LORA_ADAPTER=
```

## Quick Start

```bash
npm install
npm run dev
```

App URL:

```text
http://localhost:3000
```

Run the optional local TTS/embedding server:

```bash
pip install -r requirements.txt
npm run dev:tts
```

Run both Next.js and the Python server:

```bash
npm run dev:all
```

## Supabase Setup

Run the base schema:

```sql
-- supabase/schema.sql
```

Then run the newer vector-search and PWN scripts:

```sql
-- scripts/create_vector_search_function.sql
-- scripts/create_pwn_questions.sql
```

Seed sample curriculum data:

```bash
pip install supabase sentence-transformers python-dotenv
npm run dev:seed
```

## Neo4j Setup

Configure:

```env
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
NEO4J_DATABASE=
```

Then run helper Cypher scripts in Neo4j Browser or Aura console:

```text
scripts/neo4j_constraints.cypher
scripts/neo4j_caption_cleanup.cypher
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| App | Next.js 14 App Router |
| UI | React, Tailwind CSS, Framer Motion, lucide-react |
| Auth | Supabase Auth |
| Database | Supabase Postgres + pgvector |
| Graph DB | Neo4j |
| LLM | Google Gemini, Groq fallback |
| STT | Groq Whisper |
| OCR | Gemini Vision |
| Diagrams | Mermaid |
| PWA | next-pwa, Workbox |
| Local helper server | FastAPI, gTTS, sentence-transformers |
| Multilingual research branch | Hugging Face datasets, Transformers, PEFT LoRA/QLoRA |

## Current Main Branch File Structure

```text
src/
├─ middleware.ts
├─ types/
│  └─ index.ts
├─ lib/
│  ├─ authFlow.ts
│  ├─ embeddings.ts
│  ├─ fallbackEmbedding.ts
│  ├─ neo4j.ts
│  ├─ studentStore.ts
│  └─ supabase/
│     ├─ client.ts
│     └─ server.ts
├─ components/
│  ├─ BdslAvatar.tsx
│  ├─ EmotionBadge.tsx
│  ├─ MermaidDiagram.tsx
│  ├─ OutputModeSelector.tsx
│  ├─ Sidebar.tsx
│  ├─ SubjectSelector.tsx
│  └─ animations/
│     ├─ GenericConceptAnimation.tsx
│     ├─ MineralAnimation.tsx
│     ├─ NewtonLawAnimation.tsx
│     ├─ PhotosynthesisAnimation.tsx
│     ├─ TeachingAnimation.tsx
│     ├─ primitives.tsx
│     ├─ registry.tsx
│     └─ types.ts
└─ app/
   ├─ globals.css
   ├─ layout.tsx
   ├─ page.tsx
   ├─ login/page.tsx
   ├─ onboarding/page.tsx
   ├─ student-path/page.tsx
   ├─ learn/page.tsx
   ├─ history/page.tsx
   ├─ profile/page.tsx
   ├─ progress/page.tsx
   ├─ pwn/page.tsx
   ├─ chakma/page.tsx
   ├─ settings/page.tsx
   └─ api/
      ├─ ask/route.ts
      ├─ transcribe/route.ts
      ├─ ocr/route.ts
      ├─ tts/route.ts
      ├─ embeddings/route.ts
      ├─ curriculum-memory/route.ts
      ├─ graph-memory/route.ts
      └─ pwn/route.ts
```

```text
scripts/
├─ create_pwn_questions.sql
├─ create_vector_search_function.sql
├─ neo4j_caption_cleanup.cypher
├─ neo4j_constraints.cypher
├─ seed_curriculum.py
└─ tts_server.py

supabase/
└─ schema.sql

tests/
└─ smoke.spec.ts

public/
├─ icon.svg
├─ manifest.json
├─ sw.js
└─ workbox-4754cb34.js
```

## Ethnic Language Work On `my-feature` Branch

The `my-feature` branch contains additional files that are not all present on `main` yet.

```text
data/
├─ bangla_to_chakma_instruction.jsonl
├─ bangla_to_garo_instruction.jsonl
├─ bangla_to_marma_instruction.jsonl
├─ chakma_instruction.jsonl
├─ combined_multilingual_instruction.jsonl
├─ garo_instruction.jsonl
├─ language_detection.jsonl
└─ marma_instruction.jsonl

ml/
├─ finetune_lora.py
├─ inference.py
└─ multilingual_data.py

scripts/
└─ sync_chakma_dataset.mjs

src/
├─ data/
│  └─ chakmaPairs.json
├─ lib/
│  ├─ chakmaBridge.ts
│  ├─ marmaBridge.ts
│  └─ multilingualSupport.ts
└─ components/
   └─ AppChrome.tsx

requirements-ml.txt
```

### `my-feature` Ethnic Mode Summary

- `multilingualSupport.ts`: detects Bangla, English, Chakma, Marma, and Garo; normalizes target language aliases; defines safe fallback prompt behavior.
- `chakmaBridge.ts`: loads Chakma pairs from local JSON or Hugging Face, detects Chakma script, matches Bangla/Chakma examples, and transliterates remaining Bangla script to Chakma script.
- `marmaBridge.ts`: detects Myanmar/Marma script and loads Marma examples from local JSONL or Hugging Face.
- `sync_chakma_dataset.mjs`: downloads Chakma parallel pairs from Hugging Face into `src/data/chakmaPairs.json`.
- `ml/finetune_lora.py`: trains a LoRA/QLoRA adapter for multilingual educational assistance.
- `ml/inference.py`: runs local text inference with optional LoRA adapter using `VP_BASE_MODEL` and `VP_LORA_ADAPTER`.
- `data/*.jsonl`: instruction-tuning and language-detection datasets for Bangla, Chakma, Garo, and Marma.

## Implemented vs Roadmap

Implemented now:

- Main Bangla AI tutor flow.
- Voice input and Groq transcription fallback.
- Gemini OCR.
- Gemini/Groq tutor answers.
- Mermaid whiteboard diagrams.
- Visual teaching animations.
- Student history, concept memory, and PWN storage through Supabase-backed flows.
- Local student profile/progress state for fast MVP personalization.
- Supabase vector search helpers.
- Supabase student Q&A memory writes.
- PWN question storage and hotspot listing.
- Neo4j graph-memory writes.
- Demo BdSL avatar mode.
- Demo ethnic language bridge page.

Needs more work:

- Real ONNX emotional model instead of keyword heuristics.
- Fully implemented BdSL avatar with real sign dictionary and motion clips.
- Production-quality Chakma/Marma/Garo education translation.
- Local/offline LLM mode beyond canned offline packs.
- Larger verified NCTB curriculum dataset.
- Better test alignment with current routes and onboarding flow.
- Cleaner Bangla text encoding in older source strings.
- Teacher/admin dashboard.
- Exam practice and marking mode.

## Testing

Smoke tests are in:

```text
tests/smoke.spec.ts
```

Run:

```bash
npx playwright test
```

Some tests may need updates because the app has changed from older README assumptions.

## Deployment

```bash
npm run build
npm run start
```

For Vercel:

```bash
vercel --prod
```

Add all environment variables in the Vercel dashboard. Do not expose service-role or database secrets to the browser.

## Security Notes

- Never commit `.env.local`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Keep Neo4j credentials server-side only.
- Treat anonymous PWN data as privacy-sensitive even without names/emails.

## Branch Notes

- `main`: current app with GraphRAG, PWN, Neo4j graph memory, animations, OCR/STT, and demo ethnic/BdSL modes.
- `my-feature`: ethnic-language dataset, bridge, and multilingual LoRA research work.
- `feature/BDSL_avatar`: separate BdSL avatar work branch.

## Future Improvement Ideas

- Add ONNX emotion model for text/audio-based emotion detection.
- Complete BdSL avatar with verified Bangladeshi Sign Language motions.
- Add local LLM offline mode through Ollama, llama.cpp, or WebLLM.
- Build IndexedDB offline curriculum vector search.
- Merge `my-feature` ethnic-language bridge into `main`.
- Expand PWN into teacher-facing common-confusion analytics.
- Add exam mode for CQ, MCQ, short answers, and admission practice.

Built for Bangladesh-first learning.
