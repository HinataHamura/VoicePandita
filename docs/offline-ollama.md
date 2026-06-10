# Offline Ollama Mode

VoicePandita includes a lightweight production fallback for short Bangla-friendly answers when cloud AI is unavailable. This is not a replacement for Gemini/Groq, Supabase RAG, OCR, or STT.

## Install Ollama

Install Ollama from:

https://ollama.com/download

Then pull the required local models:

```bash
ollama pull qwen2.5:0.5b
ollama pull embeddinggemma:300m-qat-q4_0
```

Start the local LLM:

```bash
ollama run qwen2.5:0.5b
```

## Environment

Add these values to `.env.local` and restart Next.js:

```bash
NEXT_PUBLIC_ENABLE_OFFLINE_AI=true
OFFLINE_AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:0.5b
OLLAMA_EMBED_MODEL=embeddinggemma:300m-qat-q4_0
```

## Test The API

With the dev server running:

```bash
curl -X POST http://localhost:3000/api/offline-ask ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"Newton er second law bujhao\",\"subject\":\"Physics\",\"classLevel\":\"9\",\"language\":\"bn\"}"
```

Expected response includes:

```json
{
  "provider": "ollama",
  "offline": true,
  "model": "qwen2.5:0.5b",
  "embeddingModel": "embeddinggemma:300m-qat-q4_0",
  "usedContext": true
}
```

`/api/ask` also accepts:

```json
{
  "question": "Force ki?",
  "subject": "Physics",
  "offlineMode": true
}
```

## Offline Packs

Sample production pack:

`public/offline-packs/class-9-physics.json`

It currently includes class 9 Physics concepts for Newton's Second Law, motion, force, inertia, and acceleration. Search uses keyword ranking first and uses `embeddinggemma:300m-qat-q4_0` only as an optional ranking boost.

## Limitations

- `qwen2.5:0.5b` is intentionally used for short answers only.
- Internet mode gives better retrieval, richer explanations, OCR, STT, and GraphRAG.
- Groq Whisper STT still needs cloud access.
- Gemini Vision OCR still needs cloud access.
- Cloud GraphRAG and Supabase sync resume when internet is available.
- Low-resource Chakma, Marma, and Garo output should use verified datasets or safe Bangla fallback; this offline mode does not claim native-language fluency.
