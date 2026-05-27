# Vector Search - Quick Start

## কী করেছি?

pgvector দিয়ে **Semantic Search** implement করেছি। এখন:
- ✅ User question → embedding generate হয়
- ✅ Supabase-এ vector similarity search চলে
- ✅ Top 3 relevant curriculum chunks return হয়
- ✅ সেগুলো Gemini-কে context হিসেবে দেওয়া হয়
- ✅ Better, curriculum-grounded answer পাওয়া যায়

---

## শুরু করতে (5 মিনিটে)

### 1️⃣ SQL Function চালাও (Supabase-এ)

Supabase → SQL Editor → নতুন query:

```bash
# নিচের file copy করে paste করো:
scripts/create_vector_search_function.sql
```

Run করে "success" দেখো।

### 2️⃣ Curriculum Seed করো (একবার)

```bash
npm run dev:seed
```

### 3️⃣ সব services চালাও

```bash
npm run dev:all
```

### 4️⃣ Test করো

- http://localhost:3000/learn খুল
- "Newton-er second law bujhi na" লিখ
- Answer দেখ - এখন curriculum context দিয়ে আরও better হবে!

---

## কী ফাইল change হয়েছে?

| ফাইল | কী |
|------|-----|
| `scripts/create_vector_search_function.sql` | ✨ NEW - Vector search SQL function |
| `src/lib/embeddings.ts` | ✨ NEW - Embedding generation + search |
| `scripts/tts_server.py` | 📝 Updated - /embeddings endpoint যোগ করা |
| `src/app/api/ask/route.ts` | 📝 Updated - curriculum chunks support |
| `src/app/learn/page.tsx` | 📝 Updated - Vector search integration |

---

## Test করে দেখ এই ways-এ

### সবচেয়ে সহজ way - Browser-এ
```
1. Login করো
2. কোন প্রশ্ন করো: "photosynthesis explain koro"
3. F12 → Console দেখ - vector search logs থাকবে
```

### API Test করতে
```bash
curl -X POST http://localhost:8001/embeddings \
  -H "Content-Type: application/json" \
  -d '{"text":"ionic bonding kya"}'
```

### SQL-এ Direct Test
```sql
SELECT * FROM search_curriculum(
  (SELECT embedding FROM curriculum_embeddings LIMIT 1),
  0.5, 3
);
```

---

## যদি কোন problem হয়?

**"Embeddings endpoint work করছে না"**
```bash
curl http://localhost:8001/health
# Should show: {"status": "ok", "services": ["tts", "embeddings"]}
```

**"Vector search result পাচ্ছি না"**
```bash
# Supabase SQL Editor-এ:
SELECT COUNT(*) FROM curriculum_embeddings;
# 30 থাকা লাগবে
```

---

## Complete guide পড়তে

`VECTOR_SEARCH_GUIDE.md` খোল - সব technical details আছে!
