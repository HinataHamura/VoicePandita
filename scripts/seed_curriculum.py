"""
seed_curriculum.py
──────────────────
Run once to embed SSC-BanglaTutor dataset into Supabase pgvector.

Usage:
  pip install supabase sentence-transformers python-dotenv
  python seed_curriculum.py
"""

import os, json, re, time
from dotenv import load_dotenv
from supabase import create_client
from sentence_transformers import SentenceTransformer

load_dotenv('.env.local')
# load_dotenv('.env')

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
model    = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

# ── Curriculum data (expand with full SSC-BanglaTutor dataset) ──
CURRICULUM = [
  # Physics
  {"content": "Newton-এর ১ম সূত্র: বাহ্যিক বল না থাকলে স্থির বস্তু স্থির থাকে এবং গতিশীল বস্তু সমবেগে চলতে থাকে।", "subject": "physics", "chapter": "গতিবিদ্যা", "topic": "Newton-এর সূত্র"},
  {"content": "Newton-এর ২য় সূত্র: F = ma। বল = ভর × ত্বরণ। বল বেশি হলে ত্বরণ বেশি হয়।", "subject": "physics", "chapter": "গতিবিদ্যা", "topic": "Newton-এর সূত্র"},
  {"content": "Newton-এর ৩য় সূত্র: প্রতিটি ক্রিয়ার একটি সমান ও বিপরীত প্রতিক্রিয়া আছে।", "subject": "physics", "chapter": "গতিবিদ্যা", "topic": "Newton-এর সূত্র"},
  {"content": "ওহম-এর সূত্র: V = IR। ভোল্টেজ = কারেন্ট × রেজিস্ট্যান্স। V বাড়লে I বাড়ে।", "subject": "physics", "chapter": "তড়িৎ", "topic": "ওহম-এর সূত্র"},
  {"content": "গতিশক্তি: KE = ½mv²। ভর ও বেগের বর্গের গুণফলের অর্ধেক।", "subject": "physics", "chapter": "শক্তি", "topic": "গতিশক্তি"},
  {"content": "স্থিতিশক্তি: PE = mgh। ভর × অভিকর্ষজ ত্বরণ × উচ্চতা।", "subject": "physics", "chapter": "শক্তি", "topic": "স্থিতিশক্তি"},
  {"content": "তরঙ্গদৈর্ঘ্য ও কম্পাঙ্ক: v = fλ। বেগ = কম্পাঙ্ক × তরঙ্গদৈর্ঘ্য।", "subject": "physics", "chapter": "তরঙ্গ", "topic": "তরঙ্গ গতি"},

  # Chemistry
  {"content": "আয়নিক বন্ধন: ধাতু ইলেকট্রন ছেড়ে দেয়, অধাতু গ্রহণ করে। যেমন NaCl।", "subject": "chemistry", "chapter": "রাসায়নিক বন্ধন", "topic": "আয়নিক বন্ধন"},
  {"content": "সমযোজী বন্ধন: দুটি অধাতু ইলেকট্রন শেয়ার করে। যেমন H₂O, CO₂।", "subject": "chemistry", "chapter": "রাসায়নিক বন্ধন", "topic": "সমযোজী বন্ধন"},
  {"content": "pH স্কেল: ০-৭ অম্লীয়, ৭ নিরপেক্ষ, ৭-১৪ ক্ষারীয়। pH = -log[H⁺]।", "subject": "chemistry", "chapter": "এসিড-ক্ষার", "topic": "pH"},
  {"content": "মোলার ভর: এক মোল পদার্থের গ্রামে ভর। পরমাণু ভর বা আণবিক ভরের সমান।", "subject": "chemistry", "chapter": "মোল ধারণা", "topic": "মোলার ভর"},

  # Biology
  {"content": "সালোকসংশ্লেষণ: ৬CO₂ + ৬H₂O + আলো → C₆H₁₂O₆ + ৬O₂। ক্লোরোপ্লাস্টে ঘটে।", "subject": "biology", "chapter": "উদ্ভিদ শারীরবিদ্যা", "topic": "সালোকসংশ্লেষণ"},
  {"content": "মাইটোসিস: দেহকোষ বিভাজন। ২টি অভিন্ন কোষ তৈরি হয়। ধাপ: প্রোফেজ, মেটাফেজ, অ্যানাফেজ, টেলোফেজ।", "subject": "biology", "chapter": "কোষ বিভাজন", "topic": "মাইটোসিস"},
  {"content": "মিয়োসিস: জননকোষ বিভাজন। ৪টি অর্ধক্রোমোসোম সমৃদ্ধ কোষ তৈরি হয়।", "subject": "biology", "chapter": "কোষ বিভাজন", "topic": "মিয়োসিস"},
  {"content": "DNA: ডিঅক্সিরাইবো নিউক্লিক এসিড। বংশগতির মূল উপাদান। ডাবল হেলিক্স গঠন।", "subject": "biology", "chapter": "বংশগতি", "topic": "DNA"},

  # Math
  {"content": "দ্বিঘাত সমীকরণ: ax²+bx+c=0 এর সমাধান x = (-b ± √(b²-4ac)) / 2a।", "subject": "math", "chapter": "বীজগণিত", "topic": "দ্বিঘাত সমীকরণ"},
  {"content": "sin, cos, tan: একটি সমকোণ ত্রিভুজে কোণ ও বাহুর অনুপাত।", "subject": "math", "chapter": "ত্রিকোণমিতি", "topic": "ত্রিকোণমিতিক অনুপাত"},
  {"content": "লগারিদম: log(ab) = log(a) + log(b)। log(aⁿ) = n·log(a)।", "subject": "math", "chapter": "লগারিদম", "topic": "লগারিদমের সূত্র"},
]

def token_count(text):
  return len(re.findall(r"\S+", text))

def split_sentences(text):
  parts = re.split(r"(?<=[।.!?])\s+", text.strip())
  return [part.strip() for part in parts if part.strip()]

def semantic_variable_chunks(items, min_tokens=14, max_tokens=52):
  """
  Variable / semantic chunking:
  - keeps one semantic topic/chapter together where possible
  - splits by sentence boundaries
  - chunk sizes vary by concept length instead of fixed character windows
  """
  chunks = []
  for item in items:
    source_doc_id = f"{item['subject']}::{item['chapter']}::{item['topic']}"
    sentences = split_sentences(item["content"])
    current = []
    current_tokens = 0
    chunk_index = 0

    for sentence in sentences:
      sentence_tokens = token_count(sentence)
      should_flush = current and current_tokens + sentence_tokens > max_tokens
      if should_flush:
        chunks.append({
          **item,
          "content": " ".join(current),
          "source_doc_id": source_doc_id,
          "chunk_index": chunk_index,
          "chunk_type": "semantic-variable",
          "token_count": current_tokens,
        })
        chunk_index += 1
        overlap = current[-1:] if current_tokens >= min_tokens else []
        current = overlap[:]
        current_tokens = token_count(" ".join(current))

      current.append(sentence)
      current_tokens += sentence_tokens

    if current:
      chunks.append({
        **item,
        "content": " ".join(current),
        "source_doc_id": source_doc_id,
        "chunk_index": chunk_index,
        "chunk_type": "semantic-variable",
        "token_count": current_tokens,
      })

  return chunks

def contextual_summary(chunk):
  """
  Contextual RAG metadata inspired by Anthropic-style chunk context:
  a short generated context is stored beside every chunk and prepended before embedding.
  """
  return (
    f"This chunk is from {chunk['subject']} curriculum, chapter '{chunk['chapter']}', "
    f"topic '{chunk['topic']}'. It explains the core concept, formula, definition, "
    f"or example needed to answer student questions about {chunk['topic']}."
  )

def seed():
  chunks = semantic_variable_chunks(CURRICULUM)
  print(f"Seeding {len(chunks)} contextual semantic chunks from {len(CURRICULUM)} curriculum entries...")
  batch_size = 8
  for i in range(0, len(chunks), batch_size):
    batch = chunks[i : i + batch_size]
    for item in batch:
      item["contextual_summary"] = contextual_summary(item)
      item["embedding_text"] = f"{item['contextual_summary']}\n\n{item['content']}"

    texts = [item["embedding_text"] for item in batch]
    embeddings = model.encode(texts).tolist()

    rows = [
      {
        "content":   item["content"],
        "subject":   item["subject"],
        "chapter":   item["chapter"],
        "topic":     item["topic"],
        "contextual_summary": item["contextual_summary"],
        "source_doc_id": item["source_doc_id"],
        "chunk_index": item["chunk_index"],
        "chunk_type": item["chunk_type"],
        "token_count": item["token_count"],
        "embedding_text": item["embedding_text"],
        "source_type": "curriculum",
        "embedding": emb,
      }
      for item, emb in zip(batch, embeddings)
    ]

    result = supabase.table("curriculum_embeddings").insert(rows).execute()
    print(f"  Inserted batch {i//batch_size + 1} ({len(rows)} rows)")
    time.sleep(0.5)

  print("Done! Curriculum seeded.")

if __name__ == "__main__":
  seed()
