# VoicePandita 🎙️

> Bangladesh-এর প্রথম voice-first AI tutoring system।
> Voice দাও — Visual পাও। NCTB curriculum অনুযায়ী।

**The Infinity AI BuildFest 2026 | EdTech Track**

Live demo:

- https://voice-pandita.vercel.app/ (primary)
- https://voice-pandita-esha-s-projects5.vercel.app (fallback)
- https://voice-pandita-eshafarzana666-6279-esha-s-projects5.vercel.app (fallback)

If the primary link times out at the browser level, try a fallback link directly — that failure happens before the app loads, so it isn't something the app itself can recover from.

---

## What VoicePandita Does

VoicePandita is a Bangla-first AI learning companion for SSC/HSC/admission learners, built around curriculum-grounded answers instead of confident hallucination. Core pillars:

- **Ask anything, any way** — type, speak, or photograph a question; get back curriculum-grounded explanations, diagrams, or short videos.
- **Bangla-first, multilingual-aware** — Standard Bangla answers by default, with a verified-data bridge toward Chakma, Marma, and Garo instead of invented translations.
- **Deaf learner support** — AI answers are tokenized and played back through a BdSL sign-avatar.
- **Low-connectivity friendly** — offline banners, local caching, and deterministic fallbacks when AI providers or the network fail.
- **Peer learning** — Bondhu Study Room (small-group live quiz rooms) and the Peer Wisdom Network (anonymized confusion hotspots across learners).
- **Progress that means something** — voice practice grading, handwritten answer checking, and a student analytics dashboard that turns all of it into next steps.

See [`FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md) for the full, file-by-file breakdown of every implemented capability.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in the keys you need (see API Keys Required below)

# 3. Run development server
npm run dev
# → http://localhost:3000
```

Optional companion processes:

```bash
npm run dev:tts     # local Python TTS server (see NEXT_PUBLIC_TTS_URL)
npm run dev:seed    # seed curriculum content into Supabase
npm run dev:all      # dev server + local TTS server together
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/onboarding`, `/student-path` | Student profiling and learner-path selection (general, ethnic/low-resource, deaf) |
| `/login`, `/auth` | Authentication (Supabase, demo, and guest/local flows) |
| `/learn` | Main AI tutor — text/voice/image input, diagrams, animation & video modes, BdSL playback |
| `/voice-practice` | Spoken answer practice with AI grading |
| `/answer-checker` | Handwritten answer checking from photos |
| `/pdf-summary` | Bangla study-note summaries from uploaded PDFs |
| `/history` | Saved Q&A sessions |
| `/profile` | Student profile dashboard |
| `/progress` | Student analytics dashboard |
| `/study-buddy` | Bondhu Study Room (peer quiz rooms) |
| `/pwn` | Peer Wisdom Network (confusion hotspots) |
| `/chakma` | Low-resource language bridge |
| `/settings` | App preferences |
| `/pricing` | Plans overview |
| `/docs` | Live project/architecture documentation |

Protected routes are enforced in `src/middleware.ts`.

---

## API Keys Required

Copy `.env.example` to `.env.local` and fill in what you need — every integration degrades to a documented fallback when its key is missing.

### 1. Supabase (Database + Auth)
```
console.supabase.com → New Project
Copy: URL, anon/publishable key, service_role key
```

### 2. Groq (Whisper STT — Free)
```
console.groq.com → API Keys
Free tier: 7,200 seconds/day
```

### 3. Google Gemini (LLM, vision OCR, summaries — Free)
```
aistudio.google.com → Get API key
Free tier: 1,500 requests/day
```
Used for `GEMINI_MODEL` (chat), `GEMINI_VISION_MODEL` (OCR/handwriting), and optional `GEMINI_SUMMARY_MODEL`.

### 4. Neo4j (optional — graph concept memory)
```
neo4j.com/cloud/aura-free → New instance
Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
```
Graph memory writes are skipped gracefully when unset.

### 5. Local/offline AI fallback (optional)
```
NEXT_PUBLIC_ENABLE_OFFLINE_AI=true
OFFLINE_AI_PROVIDER=ollama
```
Lets `/learn` keep answering with a local Ollama model when cloud providers are unreachable — useful for low-connectivity demos.

### 6. Bondhu Study Room tuning (optional)
```
NEXT_PUBLIC_ENABLE_STUDY_BUDDY=true
STUDY_BUDDY_MIN_MEMBERS=3
STUDY_BUDDY_MAX_MEMBERS=5
```
Set `NEXT_PUBLIC_ENABLE_STUDY_BUDDY=false` to hide the feature entirely.

See [`.env.example`](.env.example) for the complete, current variable list.

---

## Supabase Setup

```sql
-- Run in Supabase SQL Editor:
-- supabase/schema.sql (full schema included)
```

Then seed the curriculum (also does pgvector embedding — see [`VECTOR_SEARCH_GUIDE.md`](VECTOR_SEARCH_GUIDE.md)):

```bash
pip install supabase sentence-transformers python-dotenv
python scripts/seed_curriculum.py
```

---

## Visual Teaching: Manim Explainer Videos

VoicePandita uses a hybrid visual-teaching architecture:

- React animations stay instant and low-bandwidth friendly in `/learn`.
- Optional Manim explainers can be pre-rendered as MP4 files for polished STEM lessons.
- If a Manim asset is missing, the app automatically falls back to the React animation or Mermaid concept map.

Current curated Manim keys:

```text
newton_second_law
quadratic_formula
photosynthesis
```

Render locally:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-manim.txt

npm run manim:list
npm run manim:render
```

Rendered videos are copied to `public/animations/manim/videos/*.mp4`. The render script updates `public/animations/manim/manifest.json` and marks successful assets as `available: true`. Do not treat a Manim video as production-ready unless the MP4 exists and the manifest marks it available.

---

## Multilingual Support (Chakma, Marma, Garo)

The `/learn` chat detects the learner's input script and treats the selected language tab as the strongest target-language signal. Language target and output script are handled separately: the tab chooses language intent, while the learner's script requests Bengali, Latin/Roman, Chakma Unicode, or Marma-script output.

```json
{
  "user_text": "<student question>",
  "input_language": "<detected language>",
  "input_script": "<detected script>",
  "target_language": "<resolved answer language>",
  "output_script": "<resolved answer script>",
  "confidence": 0.82,
  "provenance": "verified-dataset | local-bridge | unverified-demo | fallback-standard-bangla"
}
```

The API first prepares a grounded Standard Bangla answer from curriculum context, then adapts it only through verified dataset/local bridge support. Bridge data is treated as verified only for Bengali-script localized output. If bridge data is missing, confidence is low, or the learner requests unverified native/Roman output, VoicePandita returns the Standard Bangla explanation with a clear fallback reason — it never invents Chakma, Marma, or Garo text.

Chakma can use the local Bengali-script bridge when an exact or fuzzy verified match exists. Garo and Marma Bengali-script bridge rows can be added through the normalized dataset format; until verified matches exist, they safely fall back with metadata.

### Build JSONL datasets

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-ml.txt

python ml/multilingual_data.py --output-dir data
```

Optional local MELD import:

```bash
python ml/multilingual_data.py --output-dir data --meld-path /path/to/meld_folder_or_file
```

The builder loads:

| Language | Source |
|----------|--------|
| Chakma | `amlan107/chakma-nmt-base-parallel-dev-set` |
| Garo | `MWirelabs/garo-english-parallel-corpus` |
| Marma | `CLEAR-Global/marmaspeak-text` |
| MELD | local CSV, Excel, JSON, or JSONL when provided |
| Bangla | local educational seed explanations |

It writes:

```text
data/language_detection.jsonl
data/chakma_instruction.jsonl
data/garo_instruction.jsonl
data/marma_instruction.jsonl
data/bangla_to_chakma_instruction.jsonl
data/bangla_to_garo_instruction.jsonl
data/bangla_to_marma_instruction.jsonl
data/combined_multilingual_instruction.jsonl
```

The script removes empty rows, deduplicates, normalizes whitespace, preserves Unicode, tracks `source_dataset`, and prints columns plus sample rows for every loaded source. It does not synthesize fake Garo, Marma, or Chakma text — Bangla-to-Garo and Bangla-to-Marma files stay empty until verified Bangla-paired translations are available.

### Fine-tune with LoRA or QLoRA

```bash
python ml/finetune_lora.py \
  --model Qwen/Qwen2.5-1.5B-Instruct \
  --data data/combined_multilingual_instruction.jsonl \
  --output-dir models/voicepandita-multilingual-lora
```

For QLoRA on a CUDA machine:

```bash
python ml/finetune_lora.py --qlora --bf16 --model Qwen/Qwen2.5-3B-Instruct
```

You can also experiment separately with `google/mt5-base` or `facebook/nllb-200-distilled-600M` for translation-style tasks, but the provided LoRA script targets chat-style causal instruction models.

### Text-only inference

```bash
export VP_BASE_MODEL=Qwen/Qwen2.5-1.5B-Instruct
export VP_LORA_ADAPTER=models/voicepandita-multilingual-lora

python ml/inference.py "আয়নিক বন্ধন সহজ করে বুঝাও" --target-language Chakma
python ml/inference.py "আয়নিক বন্ধন সহজ করে বুঝাও" --target-language Garo
```

Programmatic functions:

```python
from ml.inference import detect_input_language, generate_answer

language = detect_input_language("আয়নিক বন্ধন সহজ করে বুঝাও")
answer = generate_answer(
    "আয়নিক বন্ধন সহজ করে বুঝাও",
    selected_target_language="Garo",
    subject_context="Chemistry -> Chemical Bonding -> Ionic Bond",
)
```

---

## Deaf Learner Support: BdSL Avatar

- Tokenizes AI answer text into signable concepts and plays them back through a CWASA/SignML avatar (`src/components/BdslAvatar.tsx`), matching against the IsharaKotha/BdSL dataset.
- Falls back to a local 3D hand-rig motion when SignML playback isn't available.
- Unknown words are routed through an agentic resolver (`/api/bdsl-translate`): Gemini/Groq suggests sign-dictionary candidates, the server validates them against the local dataset, and recovered tokens are marked `AI resolved sign`.
- Current limitation: this is text-to-sign playback, not reverse sign-language recognition from uploaded video.

---

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | Next.js 14 PWA + Tailwind | Free |
| Backend | Next.js API Routes | Free |
| Database | Supabase PostgreSQL + pgvector | Free tier |
| Graph memory | Neo4j (optional) | Free tier (Aura) |
| LLM / vision | Google Gemini | Free (1,500 req/day) |
| STT | Groq Whisper | Free (7,200s/day) |
| TTS | Google Cloud TTS / local server | Free (1M chars/month) |
| Offline fallback | Ollama (local) | Free |
| Deploy | Vercel | Free |

**Total monthly cost at MVP: BDT 0**

---

## Business Model and Global Readiness

VoicePandita uses a cross-subsidy model: keep essential learning access free for rural and low-income students, then earn sustainable revenue from premium exam support, institutions, and sponsored inclusive deployments.

| Channel | User / buyer | Offer | Sustainability logic |
|---------|--------------|-------|----------------------|
| Free student access | Rural SSC/HSC learners | Bangla Q&A, voice help, limited revision packs, offline fallback | Protects the social mission and builds adoption |
| Student premium | Families who can pay | Higher AI usage, saved history, exam-focused packs, richer practice | Low-cost recurring revenue without blocking basic access |
| School / NGO license | Schools, NGOs, learning centers | Teacher dashboard, cohort analytics, local curriculum packs, offline support | Seat or cohort pricing scales beyond individual chat usage |
| Sponsored deployment | CSR, donors, government programs | Rural, CHT, and deaf learner access packs with impact reporting | Funds learners who cannot pay directly |
| Data-safe insights | Teachers and program managers | Aggregated weak-topic and confusion hotspot reports | Uses anonymized learning signals, not private student resale |

### Adoption Pathway

1. Pilot with 2-3 rural or low-income SSC/HSC classrooms and measure active learners, questions answered, weak-topic improvement, teacher time saved, and offline-pack usage.
2. Expand through NGOs, schools, and inclusive education partners serving CHT language communities and deaf learners.
3. Add teacher dashboards, sponsored content packs, district-level reporting, and diaspora-supported mentor/content validation.
4. Localize the same architecture for other multilingual emerging markets by swapping curriculum packs, language bridges, and verified datasets.

### Global and NRB Readiness

- NRB educators and mentors can validate Bangla curriculum content, sponsor pilots, and support diaspora learner cohorts.
- University and language-data collaborators can help verify Chakma, Marma, Garo, and BdSL resources before production claims.
- The platform is modular: RAG sources, language bridges, school dashboards, accessibility layers, and offline packs can be adapted country by country.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 ← Landing page
│   ├── onboarding/, student-path/  ← Student profiling
│   ├── login/, auth/            ← Authentication
│   ├── learn/page.tsx           ← Main AI tutor
│   ├── voice-practice/          ← Spoken answer practice
│   ├── answer-checker/          ← Handwritten answer checking
│   ├── pdf-summary/             ← PDF study-note summaries
│   ├── history/page.tsx         ← Saved Q&A sessions
│   ├── profile/page.tsx         ← Student dashboard
│   ├── progress/page.tsx        ← Student analytics
│   ├── study-buddy/             ← Bondhu Study Room
│   ├── chakma/page.tsx          ← Low-resource language bridge
│   ├── pwn/page.tsx             ← Peer Wisdom Network
│   ├── settings/page.tsx        ← Settings
│   ├── docs/                    ← Live project documentation
│   └── api/
│       ├── ask/                 ← Main AI tutoring endpoint
│       ├── ocr/                 ← Gemini vision OCR
│       ├── transcribe/          ← Groq Whisper STT
│       ├── tts/                 ← Text-to-speech
│       ├── graph-memory/        ← Neo4j concept graph writes
│       ├── curriculum-memory/   ← Curriculum retrieval
│       ├── embeddings/          ← pgvector embeddings
│       ├── voice-practice/      ← Spoken answer grading
│       ├── handwritten-check/   ← Handwritten answer grading
│       ├── pdf-summary/         ← PDF summarization
│       ├── bdsl-translate/      ← BdSL missing-sign resolver
│       ├── pwn/                 ← Peer Wisdom Network clustering
│       ├── study-buddy/         ← Bondhu Study Room rooms/quiz
│       └── offline-ask/, offline-health/  ← Offline AI fallback
├── components/                  ← MermaidDiagram, BdslAvatar, Sidebar, study-buddy UI, animations, etc.
├── lib/                         ← Supabase clients, language bridges, offline search, student store
└── types/                       ← Shared TypeScript types
```

For the full list of implemented files per feature, see [`FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md).

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
# Add all env vars in Vercel dashboard → Settings → Environment Variables
```

---

## Known Gaps / Next Features

- Deaf learner video-answer upload (record a signed answer, sample frames, multimodal interpretation, score into Student Analytics) — planned, not implemented.
- Stronger BdSL recognition requires a sign-language video dataset and a pose/hand landmark model — planned.
- Bondhu Study Room realtime currently relies on polling; a dedicated realtime hook exists but isn't the primary refresh path yet.
- Broader automated test coverage for recently added features.

---

*Built with ❤️ for Bangladesh • VoicePandita • BuildFest 2026*
