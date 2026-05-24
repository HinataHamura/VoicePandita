# VoicePandita 🎙️

> Bangladesh-এর প্রথম voice-first AI tutoring system।
> Voice দাও — Visual পাও। NCTB curriculum অনুযায়ী।

**The Infinity AI BuildFest 2026 | EdTech Track**

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in all API keys (see below)

# 3. Run development server
npm run dev
# → http://localhost:3000
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/onboarding` | 5-step student profiling |
| `/learn` | Main voice tutor interface |
| `/profile` | Student dashboard |
| `/progress` | Weak topics & analytics |
| `/chakma` | Chakma ethnic language mode |
| `/pwn` | Peer Wisdom Network hotspots |
| `/settings` | App preferences |
| `/login` | Auth (Supabase) |

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

## Project Structure

```
src/
├── app/
│   ├── page.tsx              ← Landing page
│   ├── onboarding/page.tsx   ← 5-step onboarding
│   ├── learn/page.tsx        ← Voice tutor (main)
│   ├── profile/page.tsx      ← Student dashboard
│   ├── progress/page.tsx     ← Weak topics
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
