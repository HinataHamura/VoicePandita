"""
Seed curriculum/Q&A data into Supabase pgvector.

Usage:
  pip install supabase sentence-transformers python-dotenv
  python scripts/seed_curriculum.py --source data/ssc-banglatutor.jsonl --dataset ssc-banglatutor --level ssc --replace

Supported source formats:
  - JSONL: one object per line
  - JSON: list of objects or {"data": [...]}
  - CSV: header row

Expected columns are flexible. The loader recognizes common aliases for:
  question, answer/correct_answer, hints, convergence, distractors, subject, chapter, topic, level
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import time
import urllib.request
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client
from postgrest.exceptions import APIError


MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBEDDING_DIMENSION = 384
_LOCAL_MODEL = None
_AUTO_HASH_FALLBACK = False

FIELD_ALIASES = {
    "question": ["question", "q", "prompt", "instruction", "query", "প্রশ্ন"],
    "answer": ["answer", "a", "response", "output", "completion", "exactanswer", "exact_answer", "উত্তর"],
    "subject": ["subject", "sub", "বিষয়", "বিষয়"],
    "chapter": ["chapter", "chap", "unit", "অধ্যায়", "অধ্যায়"],
    "topic": ["topic", "concept", "title", "lesson", "ধারণা"],
    "level": ["level", "grade", "class", "exam"],
    "correct_answer": ["correct_answer", "correct", "correctAnswer", "exactanswer", "exact_answer", "gold_answer", "label"],
    "distractor_answers": ["distractor_answers", "distractors", "candidates_answers", "candidate_answers", "wrong_answers", "options_wrong", "misconceptions"],
    "hints": ["hints", "hint", "ranked_hints", "progressive_hints"],
    "convergence": ["convergence", "convergence_metric", "hint_probabilities", "probabilities"],
    "topic_tags": ["topic_tags", "topictags", "tags", "syllabus_tags", "curriculum_tags"],
}

FALLBACK_CURRICULUM = [
    {
        "question": "নিউটনের দ্বিতীয় সূত্র কী?",
        "answer": "নিউটনের দ্বিতীয় সূত্র বলে, বল = ভর × ত্বরণ, অর্থাৎ F = ma। একই ভরের বস্তুর উপর বেশি বল দিলে ত্বরণ বেশি হয়। আবার ভর বেশি হলে একই বলেও ত্বরণ কম হয়।",
        "subject": "physics",
        "chapter": "গতিবিদ্যা",
        "topic": "নিউটনের সূত্র",
        "level": "ssc",
    },
    {
        "question": "আয়নিক বন্ধন কী?",
        "answer": "আয়নিক বন্ধনে একটি পরমাণু ইলেকট্রন ছেড়ে ধনাত্মক আয়ন হয় এবং অন্যটি ইলেকট্রন গ্রহণ করে ঋণাত্মক আয়ন হয়। বিপরীত আধানের আকর্ষণই আয়নিক বন্ধন তৈরি করে।",
        "subject": "chemistry",
        "chapter": "রাসায়নিক বন্ধন",
        "topic": "আয়নিক বন্ধন",
        "level": "ssc",
    },
    {
        "question": "সালোকসংশ্লেষণ কীভাবে হয়?",
        "answer": "সালোকসংশ্লেষণে সবুজ উদ্ভিদ আলো, পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে গ্লুকোজ তৈরি করে এবং অক্সিজেন ছাড়ে। প্রক্রিয়াটি ক্লোরোপ্লাস্টে ঘটে।",
        "subject": "biology",
        "chapter": "উদ্ভিদ শারীরবিদ্যা",
        "topic": "সালোকসংশ্লেষণ",
        "level": "ssc",
    },
    {
        "question": "দ্বিঘাত সমীকরণের সূত্র লিখো।",
        "answer": "ax² + bx + c = 0 হলে সমাধান x = (-b ± √(b² - 4ac)) / 2a। এখানে a, b, c নির্দিষ্ট সহগ এবং a ≠ 0।",
        "subject": "math",
        "chapter": "বীজগণিত",
        "topic": "দ্বিঘাত সমীকরণ",
        "level": "ssc",
    },
]


def pick(row: dict[str, Any], field: str, default: str = "") -> str:
    aliases = FIELD_ALIASES[field]
    lower_map = {str(key).strip().lower(): value for key, value in row.items()}
    for alias in aliases:
        if alias in row and row[alias] is not None:
            value = row[alias]
            if isinstance(value, list):
                return clean(value[0] if value else "")
            return clean(value)
        value = lower_map.get(alias.lower())
        if value is not None:
            if isinstance(value, list):
                return clean(value[0] if value else "")
            return clean(value)
    return default


def clean(value: Any, max_len: int = 6000) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:max_len]


def pick_raw(row: dict[str, Any], field: str) -> Any:
    lower_map = {str(key).strip().lower(): value for key, value in row.items()}
    for alias in FIELD_ALIASES[field]:
        if alias in row and row[alias] is not None:
            return row[alias]
        value = lower_map.get(alias.lower())
        if value is not None:
            return value
    return None


def coerce_list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [clean(item, 1200) for item in value if clean(item)]
    if isinstance(value, dict):
        return [clean(value[key], 1200) for key in sorted(value.keys()) if clean(value[key])]
    text = clean(value, 4000)
    if not text:
        return []
    try:
        parsed = json.loads(text)
        return coerce_list(parsed)
    except Exception:
        return [part.strip() for part in re.split(r"\s*(?:\|\||\||;)\s*", text) if part.strip()]


def coerce_json(value: Any) -> Any:
    if value is None or value == "":
        return None
    if isinstance(value, (list, dict, int, float, bool)):
        return value
    text = clean(value, 4000)
    try:
        return json.loads(text)
    except Exception:
        return text


def fallback_embedding(text: str, dimension: int = EMBEDDING_DIMENSION) -> list[float]:
    vector = [0.0] * dimension
    tokens = clean(text.lower()).split() or ["empty"]
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        for index in range(0, len(digest), 2):
            slot = digest[index] % dimension
            sign = 1 if digest[index + 1] % 2 == 0 else -1
            vector[slot] += sign
    magnitude = sum(value * value for value in vector) ** 0.5 or 1.0
    return [value / magnitude for value in vector]


def api_embedding(text: str, url: str) -> list[float]:
    payload = json.dumps({"text": text}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))
    embedding = data.get("embedding")
    if not isinstance(embedding, list) or len(embedding) != EMBEDDING_DIMENSION:
        raise RuntimeError(f"Embedding API returned invalid vector: {type(embedding).__name__}")
    return [float(value) for value in embedding]


def encode_texts(texts: list[str], provider: str, api_url: str) -> tuple[list[list[float]], str]:
    global _AUTO_HASH_FALLBACK, _LOCAL_MODEL

    if provider == "hash":
        return [fallback_embedding(text) for text in texts], "hash-fallback"

    if provider == "api":
        return [api_embedding(text, api_url) for text in texts], f"api:{api_url}"

    if provider == "auto" and _AUTO_HASH_FALLBACK:
        return [fallback_embedding(text) for text in texts], "hash-fallback"

    try:
        from sentence_transformers import SentenceTransformer

        if _LOCAL_MODEL is None:
            _LOCAL_MODEL = SentenceTransformer(MODEL_NAME)
        return _LOCAL_MODEL.encode(texts, show_progress_bar=False).tolist(), MODEL_NAME
    except Exception as exc:
        if provider == "local":
            raise
        _AUTO_HASH_FALLBACK = True
        print(f"WARNING: local embedding model failed ({exc}). Falling back to hash embeddings.")
        return [fallback_embedding(text) for text in texts], "hash-fallback"


def normalize_subject(value: str) -> str:
    text = value.strip().lower()
    mapping = {
        "পদার্থ": "physics",
        "পদার্থবিজ্ঞান": "physics",
        "physics": "physics",
        "রসায়ন": "chemistry",
        "রসায়ন": "chemistry",
        "chemistry": "chemistry",
        "জীব": "biology",
        "জীববিজ্ঞান": "biology",
        "biology": "biology",
        "গণিত": "math",
        "math": "math",
        "mathematics": "math",
        "বাংলা": "bangla",
        "bangla": "bangla",
        "ইংরেজি": "english",
        "english": "english",
    }
    return mapping.get(text, text or "general")


def normalize_level(value: str, fallback: str) -> str:
    text = (value or fallback or "").strip().lower()
    if "ssc" in text or "9" in text or "10" in text or "class ix" in text or "class x" in text:
        return "ssc"
    if "hsc" in text or "11" in text or "12" in text or "class xi" in text or "class xii" in text:
        return "hsc"
    return text or fallback or "ssc"


def read_rows(path: Path | None) -> list[dict[str, Any]]:
    if not path:
        return FALLBACK_CURRICULUM
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    if path.suffix.lower() == ".jsonl":
        text = path.read_text(encoding="utf-8")
        rows = []
        decoder = json.JSONDecoder()
        for line_number, line in enumerate(text.splitlines(), start=1):
            line = line.strip()
            if not line:
                continue
            repaired_line = re.sub(r"(\])\}\s*,\s*\"", r'\1, "', line)
            repaired_line = repaired_line.replace('("")', '(\\"\\")')
            repaired_line = re.sub(r'(?<!\\)\\(?!["\\/bfnrtu])', r"\\\\", repaired_line)
            try:
                rows.append(json.loads(repaired_line))
                continue
            except json.JSONDecodeError:
                index = 0
                while index < len(repaired_line):
                    while index < len(repaired_line) and repaired_line[index].isspace():
                        index += 1
                    if index >= len(repaired_line):
                        break
                    try:
                        value, end = decoder.raw_decode(repaired_line, index)
                    except json.JSONDecodeError as exc:
                        raise ValueError(f"Could not parse JSONL at line {line_number}, char {index}: {exc}") from exc
                    rows.append(value)
                    index = end
        return rows
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ["data", "rows", "examples", "items"]:
                if isinstance(data.get(key), list):
                    return data[key]
        raise ValueError("JSON source must be a list or contain data/rows/examples/items list")
    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as file:
            return list(csv.DictReader(file))
    raise ValueError(f"Unsupported dataset format: {path.suffix}")


def normalize_rows(rows: list[dict[str, Any]], dataset: str, level: str) -> list[dict[str, Any]]:
    normalized = []
    seen = set()
    for raw in rows:
        question = pick(raw, "question")
        correct_answer = pick(raw, "correct_answer")
        answer = pick(raw, "answer") or correct_answer
        if not question or not answer:
            continue

        subject = normalize_subject(pick(raw, "subject", "general"))
        chapter = pick(raw, "chapter", "Unspecified chapter")
        topic = pick(raw, "topic", question[:80])
        row_level = normalize_level(pick(raw, "level", level), level)
        hints = coerce_list(pick_raw(raw, "hints"))[:5]
        distractors = coerce_list(pick_raw(raw, "distractor_answers"))
        convergence = coerce_json(pick_raw(raw, "convergence"))
        topic_tags = coerce_list(pick_raw(raw, "topic_tags"))

        content_parts = [
            f"Question: {question}",
            f"Answer: {answer}",
            f"Correct answer: {correct_answer}" if correct_answer and correct_answer != answer else "",
            "Hints:\n" + "\n".join(f"{i + 1}. {hint}" for i, hint in enumerate(hints)) if hints else "",
            "Common distractors/misconceptions: " + "; ".join(distractors) if distractors else "",
            "Topic tags: " + ", ".join(topic_tags) if topic_tags else "",
        ]
        content = "\n".join(part for part in content_parts if part)
        digest = hashlib.sha256(f"{dataset}|{row_level}|{subject}|{question}|{answer}".encode("utf-8")).hexdigest()[:20]
        if digest in seen:
            continue
        seen.add(digest)

        normalized.append({
            "question": question,
            "answer": answer,
            "correct_answer": correct_answer or answer,
            "distractor_answers": distractors,
            "hints": hints,
            "convergence": convergence,
            "topic_tags": topic_tags,
            "content": content,
            "subject": subject,
            "chapter": chapter,
            "topic": topic,
            "level": row_level,
            "source_dataset": dataset,
            "source_doc_id": f"{dataset}:{row_level}:{subject}:{digest}",
            "chunk_index": 0,
            "chunk_type": "qa-pair",
            "token_count": len(re.findall(r"\S+", content)),
        })
    return normalized


def contextual_summary(row: dict[str, Any]) -> str:
    hint_note = " It includes progressive hints and misconception-aware distractors." if row.get("hints") or row.get("distractor_answers") else ""
    return (
        f"This is a {row['level'].upper()} curriculum Q&A from {row['source_dataset']}. "
        f"Subject: {row['subject']}; chapter: {row['chapter']}; topic: {row['topic']}. "
        f"Use it to answer Bangla student questions with textbook-grounded explanations.{hint_note}"
    )


def batched(items: list[dict[str, Any]], size: int):
    for index in range(0, len(items), size):
        yield index, items[index:index + size]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=os.environ.get("SSC_BANGLATUTOR_PATH"), help="Path to JSONL/JSON/CSV dataset")
    parser.add_argument("--dataset", default=os.environ.get("CURRICULUM_DATASET", "ssc-banglatutor"))
    parser.add_argument("--level", default=os.environ.get("CURRICULUM_LEVEL", "ssc"))
    parser.add_argument("--batch-size", type=int, default=int(os.environ.get("SEED_BATCH_SIZE", "64")))
    parser.add_argument(
        "--embedding-provider",
        choices=["auto", "local", "api", "hash"],
        default=os.environ.get("SEED_EMBEDDING_PROVIDER", "auto"),
        help="auto/local uses sentence-transformers; api calls Next /api/embeddings; hash is low-memory deterministic fallback",
    )
    parser.add_argument(
        "--embedding-api-url",
        default=os.environ.get("SEED_EMBEDDING_API_URL", "http://localhost:3000/api/embeddings"),
    )
    parser.add_argument("--replace", action="store_true", help="Delete existing rows for this source_dataset before inserting")
    args = parser.parse_args()

    load_dotenv(".env.local")
    supabase_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(supabase_url, supabase_key)

    source = Path(args.source) if args.source else None
    rows = normalize_rows(read_rows(source), args.dataset, args.level)
    if not rows:
        raise RuntimeError("No valid Q&A rows found. Check question/answer columns.")

    if args.replace:
        print(f"Deleting existing rows for source_dataset={args.dataset}...")
        supabase.table("curriculum_embeddings").delete().eq("source_dataset", args.dataset).execute()

    print(f"Seeding {len(rows)} rows from {source or 'built-in fallback'} as {args.dataset}...")
    for batch_index, batch in batched(rows, args.batch_size):
        for row in batch:
            row["contextual_summary"] = contextual_summary(row)
            row["embedding_text"] = (
                f"{row['contextual_summary']}\n\n"
                f"Question: {row['question']}\n"
                f"Answer: {row['answer']}\n"
                + ("Hints:\n" + "\n".join(row["hints"]) + "\n" if row["hints"] else "")
                + ("Distractors: " + "; ".join(row["distractor_answers"]) if row["distractor_answers"] else "")
            )

        embeddings, embedding_source = encode_texts(
            [row["embedding_text"] for row in batch],
            args.embedding_provider,
            args.embedding_api_url,
        )
        payload = []
        for row, embedding in zip(batch, embeddings):
            payload.append({
                "content": row["content"],
                "subject": row["subject"],
                "chapter": row["chapter"],
                "topic": row["topic"],
                "contextual_summary": row["contextual_summary"],
                "source_doc_id": row["source_doc_id"],
                "chunk_index": row["chunk_index"],
                "chunk_type": row["chunk_type"],
                "token_count": row["token_count"],
                "embedding_text": row["embedding_text"],
                "source_type": "curriculum",
                "level": row["level"],
                "source_dataset": row["source_dataset"],
                "question_text": row["question"],
                "answer_text": row["answer"],
                "correct_answer": row["correct_answer"],
                "distractor_answers": row["distractor_answers"],
                "hints": row["hints"],
                "convergence": row["convergence"],
                "topic_tags": row["topic_tags"],
                "metadata": {
                    "ingest": "seed_curriculum.py",
                    "embedding_source": embedding_source,
                    "license": "CC BY 4.0",
                    "doi": "10.17632/krn9bzypsn.1" if row["source_dataset"] == "ssc-banglatutor" else None,
                },
                "embedding": embedding,
            })

        try:
            supabase.table("curriculum_embeddings").upsert(payload, on_conflict="source_doc_id").execute()
        except APIError as exc:
            message = str(exc)
            if "no unique or exclusion constraint" not in message and "42P10" not in message:
                raise
            print("WARNING: source_doc_id unique index is missing; falling back to insert for this batch.")
            supabase.table("curriculum_embeddings").insert(payload).execute()
        print(f"  Inserted {batch_index + len(batch)}/{len(rows)}")
        time.sleep(0.1)

    print("Done. Run scripts/create_vector_search_function.sql in Supabase before searching.")


if __name__ == "__main__":
    main()
