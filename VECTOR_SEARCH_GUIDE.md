# Vector Search (pgvector) Implementation Guide

## Overview
VoicePandita এখন **Vector Search** ব্যবহার করে Supabase-এ stored curriculum থেকে relevant topics খুঁজে বের করে, তারপর সেটা AI response-এ context হিসেবে দেয়।

---

## Architecture

```
User Question
    ↓
[1] Generate Embedding (TTS Server)
    ↓
[2] Vector Similarity Search (Supabase pgvector)
    ↓
[3] Retrieve Top 3 Curriculum Chunks
    ↓
[4] Pass as Context to Gemini API
    ↓
[5] Better, Curriculum-Grounded Answer
```

---

## Setup Steps

### Step 1: Run SQL Function in Supabase

1. Go to: https://app.supabase.com → Your Project
2. **SQL Editor** → **New Query**
3. Copy entire content from: `scripts/create_vector_search_function.sql`
4. Paste and **Run**

**Expected output:**
```
search_curriculum function created successfully!
```

### Step 2: Seed Curriculum Data (if not done)

```bash
npm run dev:seed
```

This creates embeddings for 30 curriculum topics in Supabase.

### Step 3: Verify Table in Supabase

```sql
SELECT COUNT(*) as total, COUNT(DISTINCT subject) as subjects
FROM curriculum_embeddings;
```

**Should return:** 30 rows, 4 subjects

### Step 4: Start All Services

```bash
npm run dev:all
```

This starts:
- ✅ Next.js (port 3000)
- ✅ TTS + Embeddings Server (port 8001)

---

## Testing

### Test 1: Verify Embeddings Endpoint

In a new terminal:

```bash
curl -X POST http://localhost:8001/embeddings \
  -H "Content-Type: application/json" \
  -d '{"text": "Newton er second law explain koro"}'
```

**Expected response:**
```json
{
  "embedding": [0.123, -0.456, 0.789, ...],
  "dimension": 384
}
```

### Test 2: Verify Vector Search Function

In Supabase SQL Editor:

```sql
SELECT * FROM search_curriculum(
  (SELECT embedding FROM curriculum_embeddings LIMIT 1),
  0.5,
  3
);
```

**Expected:** 3 rows with similarity scores

### Test 3: End-to-End Learning Test

1. Open http://localhost:3000/learn
2. Login or use demo account
3. Ask a question about curriculum:
   - ✅ "Newton-er second law bujhi na"
   - ✅ "ionic bonding explain koro"
   - ✅ "photosynthesis kya?"

4. Check browser console (F12 → Console):
   ```
   Vector search found 3 curriculum chunks
   Sending to API with context...
   ```

5. Answer should now use curriculum data!

### Test 4: Verify in Network Tab

Browser DevTools → Network → Filter "ask"

Request payload should include:
```json
{
  "curriculumChunks": [
    {
      "content": "Newton-এর ২য় সূত্র: F = ma...",
      "topic": "Newton-এর সূত্র",
      "similarity": 0.87
    },
    ...
  ]
}
```

---

## Troubleshooting

### ❌ "Embeddings endpoint not working"
```bash
# Check if TTS server is running
curl http://localhost:8001/health

# Should return: {"status": "ok", "services": ["tts", "embeddings"]}

# If not, restart:
npm run dev:tts
```

### ❌ "Vector search returns 0 results"
```sql
-- Check if curriculum_embeddings table exists and has data
SELECT COUNT(*) FROM curriculum_embeddings;

-- Check if search_curriculum function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'search_curriculum';
```

### ❌ "API returns error with curriculum chunks"
- Check `.env.local` has `NEXT_PUBLIC_TTS_URL=http://localhost:8001`
- Verify TTS server embeddings endpoint works
- Check browser console for fetch errors

### ❌ "Similarity scores are too low"
Change threshold in Learn page (`src/app/learn/page.tsx`):
```typescript
const curriculumChunks = await searchCurriculum(
  question, 
  supabase, 
  0.3,  // Lower threshold = more results (was 0.5)
  5     // More results (was 3)
)
```

---

## Files Changed/Created

| File | Status | Purpose |
|------|--------|---------|
| `scripts/create_vector_search_function.sql` | ✨ NEW | Supabase function for vector search |
| `src/lib/embeddings.ts` | ✨ NEW | Frontend utility for embeddings + search |
| `scripts/tts_server.py` | 📝 MODIFIED | Added `/embeddings` endpoint |
| `src/app/api/ask/route.ts` | 📝 MODIFIED | Accept & use curriculum chunks |
| `src/app/learn/page.tsx` | 📝 MODIFIED | Call vector search before API |

---

## How Vector Search Works (Technical)

1. **Embedding Generation**
   - User question: "Newton er 2nd law explain koro"
   - Converted to 384-dimensional vector using sentence-transformers
   - Sent to embeddings endpoint

2. **Similarity Search**
   - Supabase `search_curriculum()` function compares vectors
   - Uses cosine distance: `1 - (embedding <=> query_embedding)`
   - Returns top 3 matches with similarity score

3. **Context Injection**
   - Chunks sent to Gemini as additional context
   - Gemini uses curriculum facts to ground response
   - Answer becomes more accurate & curriculum-aligned

4. **Score Interpretation**
   - 1.0 = Perfect match
   - 0.7+ = Very relevant
   - 0.5-0.7 = Somewhat relevant
   - <0.5 = Not relevant

---

## Monitoring

**Check what embeddings are being used:**

In Supabase, run:
```sql
SELECT topic, content, embedding
FROM curriculum_embeddings
ORDER BY created_at DESC
LIMIT 5;
```

**Check search function is being called:**

Server logs should show:
```
Vector search found 3 curriculum chunks for question...
Sending to Gemini with curriculum context...
```

---

## Performance Tips

1. **Reduce threshold for more results**
   ```typescript
   const curriculumChunks = await searchCurriculum(question, supabase, 0.4, 5)
   ```

2. **Increase match count for better context**
   - Currently: 3 chunks
   - Try: 5-7 chunks (may slow down slightly)

3. **Monitor embeddings generation time**
   - First call: ~500ms (model loads)
   - Subsequent: ~100ms (cached)

---

## Next Steps

Once vector search works:
- [ ] Fine-tune similarity threshold
- [ ] Add more curriculum data (expand from 30 to 100+ topics)
- [ ] Monitor & log search quality
- [ ] Train custom embedding model for Bengali
- [ ] Add RAG metrics dashboard
