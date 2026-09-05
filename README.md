# VoicePandita 🎙️

Live demo links:

- https://voice-pandita-esha-s-projects5.vercel.app
- https://voice-pandita-eshafarzana666-6279-esha-s-projects5.vercel.app
- https://voice-pandita.vercel.app/

> Bangladesh-এর প্রথম voice-first AI tutoring system।
> Voice দাও — Visual পাও। NCTB curriculum অনুযায়ী।

**The Infinity AI BuildFest 2026 | EdTech Track**

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local .env.local
# Fill in all API keys (see below)

# 3. Run development server
npm run dev
# → http://localhost:3000
```

---

## Manim Explainer Videos

VoicePandita uses a hybrid visual-teaching architecture:

- Existing React animations stay instant and low-bandwidth friendly in `/learn`.
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

Rendered videos are copied to:

```text
public/animations/manim/videos/*.mp4
```

The render script updates `public/animations/manim/manifest.json` and marks successful assets as `available: true`. Do not claim AI-generated Manim videos as production-ready unless the MP4 exists and the manifest marks it available.

---

## Text Multilingual Support

The `/learn` chat detects the learner's input script and keeps the selected language tab as the strongest target-language signal. For Chakma/Garo/Marma, language target and output script are handled separately: the tab chooses the language intent, while the learner's script asks for Bengali, Latin/Roman, Chakma Unicode, or Marma-script output.

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

The API first prepares a grounded Standard Bangla answer from curriculum context, then adapts that answer only through verified dataset/local bridge support. The current bridge data is treated as verified only for Bengali-script localized output. If bridge data is missing, confidence is low, or the learner requests unverified native/Roman output, VoicePandita returns a Standard Bangla explanation with a clear fallback reason.

Chakma can use the local Bengali-script bridge when an exact or fuzzy verified match exists. Garo and Marma Bengali-script bridge rows can be added through the normalized dataset format; until verified matches exist, they safely fall back with metadata. The app does not claim perfect translation for low-resource languages.

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

The script removes empty rows, deduplicates rows, normalizes whitespace, preserves Unicode, tracks `source_dataset`, and prints columns plus sample rows for every loaded source. It does not synthesize fake Garo, Marma, or Chakma text. Bangla-to-Garo and Bangla-to-Marma files stay empty until verified Bangla-paired translations are available.

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

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/onboarding` | 5-step student profiling |
| `/learn` | Main voice tutor interface |
| `/profile` | Student dashboard |
| `/progress` | Student Analytics Dashboard |
| `/study-buddy` | Bondhu Study Room |
| `/chakma` | Chakma ethnic language mode |
| `/pwn` | Peer Wisdom Network hotspots |
| `/settings` | App preferences |
| `/login` | Auth (Supabase) |

---

## Live Demo Links

Primary link:

- https://voice-pandita.vercel.app/

If the primary link is unavailable or shows a browser connection timeout, try one of these Vercel deployment links. Browser-level timeout pages are outside the app, so the fallback links need to be shared separately before opening the site.

- https://voice-pandita-esha-s-projects5.vercel.app
- https://voice-pandita-eshafarzana666-6279-esha-s-projects5.vercel.app

---

## API Keys Required

### 1. Supabase (Database + Auth)
```
console.supabase.com → New Project
Copy: URL, anon key, service_role key
```

### 2. Groq (Whisper STT — Free)
```
console.groq.com → API Keys
Free tier: 7,200 seconds/day
```

### 3. Google Gemini (LLM — Free)
```
aistudio.google.com → Get API key
Free tier: 1,500 requests/day
```

### 4. Google Cloud TTS (Voice — Free)
```
console.cloud.google.com → Enable TTS API → Create service account
Free tier: 1M characters/month
```

### 5. Upstash Redis (Cache — Free)
```
console.upstash.com → Create database
Free tier: 10,000 commands/day
```

---

## Supabase Setup

```sql
-- Run in Supabase SQL Editor:
-- supabase/schema.sql (full schema included)
```

Then seed the curriculum:
```bash
pip install supabase sentence-transformers python-dotenv
python scripts/seed_curriculum.py
```

---

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | Next.js 14 PWA + Tailwind | Free |
| Backend | Next.js API Routes | Free |
| Database | Supabase PostgreSQL + pgvector | Free tier |
| LLM | Gemini 1.5 Flash | Free (1,500 req/day) |
| STT | Groq Whisper | Free (7,200s/day) |
| TTS | Google Cloud TTS | Free (1M chars/month) |
| Cache | Upstash Redis | Free |
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
- The market pattern is global: underserved learners need low-cost, curriculum-grounded, voice-first tutoring in local languages.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              ← Landing page
│   ├── onboarding/page.tsx   ← 5-step onboarding
│   ├── learn/page.tsx        ← Voice tutor (main)
│   ├── profile/page.tsx      ← Student dashboard
│   ├── progress/page.tsx     ← Student analytics
│   ├── study-buddy/          ← Bondhu Study Room
│   ├── chakma/page.tsx       ← Ethnic language mode
│   ├── pwn/page.tsx          ← Peer Wisdom Network
│   ├── settings/page.tsx     ← Settings
│   ├── login/page.tsx        ← Auth
│   └── api/
│       ├── ask/route.ts      ← Main AI endpoint
│       ├── transcribe/route.ts ← Groq Whisper STT
│       ├── tts/route.ts      ← Google TTS
│       └── pwn/route.ts      ← Community clustering
├── components/
│   ├── MermaidDiagram.tsx    ← Concept diagrams
│   ├── EmotionBadge.tsx      ← Emotion indicator
│   ├── SubjectSelector.tsx   ← Subject dropdown
│   ├── OutputModeSelector.tsx← Output mode tabs
│   └── Sidebar.tsx           ← Navigation drawer
├── lib/
│   └── supabase/
│       ├── client.ts         ← Browser client
│       └── server.ts         ← Server client
└── types/
    └── index.ts              ← TypeScript types
```

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
# Add all env vars in Vercel dashboard → Settings → Environment Variables
```

---

## May 15 Demo Checklist

- [ ] Voice → Whisper STT → working
- [ ] Gemini explanation → working
- [ ] Mermaid diagram → rendering
- [ ] Emotion detection → prompt adapts
- [ ] Chakma mode → language bridge
- [ ] Offline demo → Chrome DevTools → Network → Offline
- [ ] PWN hotspots → `/pwn` page shows data

---

## June 12 Full Build TODO

- [ ] Real Neo4j concept graph (replace JSON stub)
- [ ] mBERT fine-tuned on MELD (3,046 sentences)
- [ ] Full ONNX emotion model (acoustic features)
- [ ] Three.js BdSL Sign Language Avatar (30 signs)
- [ ] Supabase pgvector RAG (replace mock context)
- [ ] Student Skill DNA passive tracking
- [ ] Recharts progress analytics

---

*Built with ❤️ for Bangladesh • VoicePandita • BuildFest 2026*
