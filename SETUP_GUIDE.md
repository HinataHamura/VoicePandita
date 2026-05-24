# VoicePandita Development Setup Guide

## Overview
Your app has 3 components:
1. **Next.js Frontend** (port 3000)
2. **TTS Server** (port 8001) - Text-to-speech using gTTS
3. **Curriculum Seed Script** - One-time data seeding to Supabase

---

## Initial Setup

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

---

## Running Development Environment

### Option A: Everything at Once (Recommended)
```bash
npm run dev:all
```
This starts:
- ✅ Next.js dev server (http://localhost:3000)
- ✅ TTS server (http://localhost:8001)

### Option B: Run Separately (If you prefer debugging)

**Terminal 1 - Next.js Frontend:**
```bash
npm run dev
```

**Terminal 2 - TTS Server:**
```bash
npm run dev:tts
```

---

## Curriculum Seeding (One-time Setup)

Run once to populate Supabase with curriculum data + embeddings:
```bash
npm run dev:seed
```

**Note:** Only run once! The script embeds all curriculum content and uploads to Supabase. Running it again will create duplicates.

---

## Environment Variables

Check `.env.local` has these set:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GROQ_API_KEY=...
GEMINI_API_KEY=...
NEXT_PUBLIC_TTS_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Using TTS in Your App

The TTS server is now available at `http://localhost:8001/tts`

**Example API call:**
```javascript
const response = await fetch(`${process.env.NEXT_PUBLIC_TTS_URL}/tts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    text: 'তোমার Bengali টেক্সট এখানে', 
    slow: false 
  }),
});
const audioBlob = await response.blob();
const url = URL.createObjectURL(audioBlob);
const audio = new Audio(url);
audio.play();
```

---

## Troubleshooting

### TTS Server Won't Start
```bash
# Check if port 8001 is in use
lsof -i :8001  # macOS/Linux
netstat -ano | findstr :8001  # Windows

# Kill the process and try again
```

### Python Dependencies Missing
```bash
pip install --upgrade -r requirements.txt
```

### Curriculum Seeding Fails
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- Check internet connection
- Ensure Supabase table `curriculum_embeddings` exists

---

## Project Structure
```
VoicePandita/
├── scripts/
│   ├── tts_server.py           # FastAPI TTS server
│   └── seed_curriculum.py      # Curriculum data seeder
├── src/
│   └── app/                    # Next.js pages
├── requirements.txt            # Python dependencies
├── package.json               # Node dependencies + scripts
└── .env.local                 # Environment variables
```
