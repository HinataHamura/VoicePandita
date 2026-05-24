#!/usr/bin/env python3
"""
Build text-only multilingual training JSONL files for VoicePandita.

The script loads the requested Hugging Face datasets, optional local MELD files,
normalizes/deduplicates rows, prints columns and samples, and writes instruction
datasets without inventing Chakma, Garo, or Marma text.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable

try:
    import pandas as pd
except ImportError:  # pragma: no cover - handled at runtime
    pd = None

try:
    from datasets import Dataset, DatasetDict, load_dataset
except ImportError:  # pragma: no cover - handled at runtime
    Dataset = Any
    DatasetDict = Any
    load_dataset = None


HF_DATASETS = {
    "chakma_hf": "amlan107/chakma-nmt-base-parallel-dev-set",
    "garo_hf": "MWirelabs/garo-english-parallel-corpus",
    "marma_hf": "CLEAR-Global/marmaspeak-text",
}

OUTPUT_FILES = {
    "language_detection": "language_detection.jsonl",
    "chakma_instruction": "chakma_instruction.jsonl",
    "garo_instruction": "garo_instruction.jsonl",
    "marma_instruction": "marma_instruction.jsonl",
    "bangla_to_chakma": "bangla_to_chakma_instruction.jsonl",
    "bangla_to_garo": "bangla_to_garo_instruction.jsonl",
    "bangla_to_marma": "bangla_to_marma_instruction.jsonl",
    "combined": "combined_multilingual_instruction.jsonl",
}

LANGUAGE_ALIASES = {
    "Bangla": ("bangla", "bengali", "bn", "ben", "বাংলা"),
    "English": ("english", "en", "eng"),
    "Chakma": ("chakma", "ccp", "ckm"),
    "Garo": ("garo", "grt", "gnk", "achik", "a.chik", "mandi"),
    "Marma": ("marma", "mrm"),
}

BANGLA_EDU_EXAMPLES = [
    {
        "question": "আয়নিক বন্ধন সহজ করে বুঝাও",
        "answer": "আয়নিক বন্ধনে এক পরমাণু ইলেকট্রন ছেড়ে দেয়, আর অন্য পরমাণু সেটি গ্রহণ করে। ফলে ধনাত্মক ও ঋণাত্মক আয়ন তৈরি হয়। বিপরীত আধানের আকর্ষণই আয়নিক বন্ধনকে ধরে রাখে।",
        "subject_context": "Chemistry -> Chemical Bonding -> Ionic Bond",
    },
    {
        "question": "সালোকসংশ্লেষণ কীভাবে হয়?",
        "answer": "সালোকসংশ্লেষণে সবুজ উদ্ভিদ সূর্যের আলো, পানি এবং কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে। ক্লোরোফিল আলো ধরতে সাহায্য করে। শেষে গ্লুকোজ তৈরি হয় এবং অক্সিজেন বের হয়।",
        "subject_context": "Biology -> Plant Physiology -> Photosynthesis",
    },
    {
        "question": "নিউটনের দ্বিতীয় সূত্র কী?",
        "answer": "নিউটনের দ্বিতীয় সূত্র বলে, বল = ভর × ত্বরণ, অর্থাৎ F = ma। একই ভরের বস্তুর উপর বেশি বল দিলে ত্বরণ বেশি হয়। আবার ভর বেশি হলে একই বলেও ত্বরণ কম হয়।",
        "subject_context": "Physics -> Force and Motion -> Newton's Second Law",
    },
]


def normalize_whitespace(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\ufeff", "").strip()
    return re.sub(r"\s+", " ", text)


def clean_records(records: Iterable[dict[str, Any]], source_dataset: str) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    seen: set[str] = set()
    for record in records:
        row = {str(key): normalize_whitespace(value) for key, value in record.items()}
        row = {key: value for key, value in row.items() if value}
        if not row:
            continue
        key = json.dumps(row, ensure_ascii=False, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        row["source_dataset"] = source_dataset
        cleaned.append(row)
    return cleaned


def choose_split(dataset: Any) -> Any:
    if not isinstance(dataset, DatasetDict):
        return dataset
    for split in ("train", "dev_val", "validation", "test"):
        if split in dataset:
            return dataset[split]
    return next(iter(dataset.values()))


def print_profile(name: str, records: list[dict[str, Any]], sample_size: int) -> None:
    print(f"\n=== {name} ===")
    if not records:
        print("No rows loaded.")
        return
    columns = sorted({column for row in records for column in row.keys()})
    print(f"Rows: {len(records)}")
    print(f"Columns: {columns}")
    print("Sample rows:")
    for row in records[:sample_size]:
        print(json.dumps(row, ensure_ascii=False)[:1200])


def load_hf_records(name: str, dataset_id: str, sample_size: int, max_rows: int | None) -> list[dict[str, Any]]:
    if load_dataset is None:
        records = load_hf_records_via_server(name, dataset_id, sample_size, max_rows)
        if records:
            return records
        print(f"Skipping {dataset_id}: install datasets first or check Hugging Face datasets-server access.")
        return []
    try:
        dataset = choose_split(load_dataset(dataset_id))
        if max_rows:
            dataset = dataset.select(range(min(max_rows, len(dataset))))
        records = clean_records(dataset, dataset_id)
        print_profile(name, records, sample_size)
        return records
    except Exception as exc:  # pragma: no cover - network/dataset dependent
        print(f"Failed to load {dataset_id}: {exc}")
        return load_hf_records_via_server(name, dataset_id, sample_size, max_rows)


def hf_get_json(endpoint: str, params: dict[str, str]) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(f"https://datasets-server.huggingface.co/{endpoint}?{query}")
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
    if hf_token:
        request.add_header("Authorization", f"Bearer {hf_token}")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def choose_hf_split(dataset_id: str) -> tuple[str, str] | None:
    try:
        payload = hf_get_json("splits", {"dataset": dataset_id})
    except Exception as exc:
        print(f"Failed to inspect splits for {dataset_id}: {exc}")
        return None
    splits = payload.get("splits") or []
    if not splits:
        return None
    preferred = ("train", "dev_val", "validation", "test")
    for split_name in preferred:
        for split in splits:
            if split.get("split") == split_name:
                return str(split.get("config", "default")), split_name
    first = splits[0]
    return str(first.get("config", "default")), str(first.get("split"))


def load_hf_records_via_server(name: str, dataset_id: str, sample_size: int, max_rows: int | None) -> list[dict[str, Any]]:
    selected = choose_hf_split(dataset_id)
    if not selected:
        return []
    config, split = selected
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 100
    total = max_rows or page_size
    while offset < total:
        length = min(page_size, total - offset)
        try:
            payload = hf_get_json(
                "rows",
                {
                    "dataset": dataset_id,
                    "config": config,
                    "split": split,
                    "offset": str(offset),
                    "length": str(length),
                },
            )
        except Exception as exc:
            print(f"Failed to fetch rows for {dataset_id}: {exc}")
            break
        raw_rows = [item.get("row", {}) for item in payload.get("rows", [])]
        rows.extend(raw_rows)
        total_rows = int(payload.get("num_rows_total") or len(rows))
        total = min(max_rows or total_rows, total_rows)
        if not raw_rows:
            break
        offset += len(raw_rows)
    records = clean_records(rows, dataset_id)
    print_profile(f"{name} ({config}/{split}, datasets-server)", records, sample_size)
    return records


def read_local_file(path: Path) -> list[dict[str, Any]]:
    if pd is None:
        raise RuntimeError("Install pandas/openpyxl to load local CSV, Excel, or JSON files.")
    suffix = path.suffix.lower()
    if suffix == ".csv":
        frame = pd.read_csv(path)
    elif suffix in {".xlsx", ".xls"}:
        frame = pd.read_excel(path)
    elif suffix in {".json", ".jsonl"}:
        frame = pd.read_json(path, lines=suffix == ".jsonl")
    else:
        return []
    return frame.fillna("").astype(str).to_dict(orient="records")


def load_local_meld(path_value: str | None, sample_size: int, max_rows: int | None) -> list[dict[str, Any]]:
    if not path_value:
        candidates = [Path("data/meld"), Path("datasets/meld"), Path("MELD"), Path("meld")]
    else:
        candidates = [Path(path_value)]

    files: list[Path] = []
    for candidate in candidates:
        if candidate.is_file():
            files.append(candidate)
        elif candidate.is_dir():
            for pattern in ("*.csv", "*.xlsx", "*.xls", "*.json", "*.jsonl"):
                files.extend(sorted(candidate.glob(pattern)))

    all_rows: list[dict[str, Any]] = []
    for file_path in files:
        try:
            rows = read_local_file(file_path)
            if max_rows:
                rows = rows[:max_rows]
            records = clean_records(rows, f"local_meld:{file_path}")
            print_profile(f"local_meld:{file_path}", records, sample_size)
            all_rows.extend(records)
        except Exception as exc:
            print(f"Failed to load {file_path}: {exc}")
    return all_rows


def find_column(row: dict[str, Any], language: str) -> str | None:
    aliases = LANGUAGE_ALIASES[language]
    normalized_columns = {column.lower().replace("-", "_").replace(" ", "_"): column for column in row.keys()}
    for alias in aliases:
        alias_key = alias.lower().replace("-", "_").replace(" ", "_")
        for normalized, original in normalized_columns.items():
            if normalized == alias_key or normalized.endswith(f"_{alias_key}") or alias_key in normalized.split("_"):
                return original
    return None


def detect_language_from_script(text: str) -> str:
    if any(0x11100 <= ord(char) <= 0x1114F for char in text):
        return "Chakma"
    if any(0x1000 <= ord(char) <= 0x109F for char in text):
        return "Marma"
    if any(0x0980 <= ord(char) <= 0x09FF for char in text):
        return "Bangla"
    if re.search(r"[A-Za-z]", text):
        return "English"
    return "unknown"


def collect_language_texts(records: list[dict[str, Any]], dataset_language: str | None = None) -> list[tuple[str, str, str]]:
    examples: list[tuple[str, str, str]] = []
    for row in records:
        source_dataset = row.get("source_dataset", "unknown")
        languages = ["Bangla", "English", "Chakma", "Garo", "Marma"]
        for language in languages:
            column = find_column(row, language)
            if column and row.get(column):
                examples.append((row[column], language, source_dataset))
        if dataset_language:
            for column, value in row.items():
                if column == "source_dataset":
                    continue
                if value and (value, dataset_language, source_dataset) not in examples:
                    examples.append((value, dataset_language, source_dataset))
                    break
    return examples


def make_detection_examples(language_texts: Iterable[tuple[str, str, str]]) -> list[dict[str, Any]]:
    examples = []
    seen: set[str] = set()
    for text, language, source_dataset in language_texts:
        key = f"{language}\n{text}"
        if not text or key in seen:
            continue
        seen.add(key)
        examples.append(
            {
                "instruction": "Detect the language of this text.",
                "input": text,
                "output": language,
                "source_dataset": source_dataset,
            }
        )
    return examples


def make_pair_examples(
    records: list[dict[str, Any]],
    source_language: str,
    target_language: str,
    instruction: str,
    subject_context: str = "",
) -> list[dict[str, Any]]:
    examples: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in records:
        source_col = find_column(row, source_language)
        target_col = find_column(row, target_language)
        if not source_col or not target_col:
            continue
        source_text = row.get(source_col, "")
        target_text = row.get(target_col, "")
        if not source_text or not target_text:
            continue
        key = f"{instruction}\n{source_text}\n{target_text}"
        if key in seen:
            continue
        seen.add(key)
        examples.append(
            {
                "instruction": instruction,
                "input": source_text,
                "output": target_text,
                "source_dataset": row.get("source_dataset", "unknown"),
            }
        )
    return examples


def make_target_instruction_examples(
    records: list[dict[str, Any]],
    target_language: str,
    source_languages: tuple[str, ...],
) -> list[dict[str, Any]]:
    examples: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in records:
        target_col = find_column(row, target_language)
        if not target_col or not row.get(target_col):
            continue
        for source_language in source_languages:
            source_col = find_column(row, source_language)
            if not source_col or not row.get(source_col):
                continue
            source_text = row[source_col]
            target_text = row[target_col]
            key = f"{source_language}->{target_language}\n{source_text}\n{target_text}"
            if key in seen:
                continue
            seen.add(key)
            examples.append(
                {
                    "instruction": "Answer the student's question in the selected target language.",
                    "input": {
                        "user_text": source_text,
                        "input_language": source_language,
                        "target_language": target_language,
                        "subject_context": "",
                    },
                    "output": target_text,
                    "source_dataset": row.get("source_dataset", "unknown"),
                }
            )
    return examples


def make_bangla_instruction_examples() -> list[dict[str, Any]]:
    return [
        {
            "instruction": "Answer the student's question in the selected target language.",
            "input": {
                "user_text": item["question"],
                "input_language": "Bangla",
                "target_language": "Bangla",
                "subject_context": item["subject_context"],
            },
            "output": item["answer"],
            "source_dataset": "local_bangla_educational_seed",
        }
        for item in BANGLA_EDU_EXAMPLES
    ]


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Wrote {len(rows):>6} rows -> {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="data")
    parser.add_argument("--meld-path", default=None, help="Optional local MELD CSV/XLSX/JSON/JSONL file or directory.")
    parser.add_argument("--max-rows", type=int, default=None)
    parser.add_argument("--sample-size", type=int, default=3)
    args = parser.parse_args()

    chakma = load_hf_records("chakma_hf", HF_DATASETS["chakma_hf"], args.sample_size, args.max_rows)
    garo = load_hf_records("garo_hf", HF_DATASETS["garo_hf"], args.sample_size, args.max_rows)
    marma = load_hf_records("marma_hf", HF_DATASETS["marma_hf"], args.sample_size, args.max_rows)
    meld = load_local_meld(args.meld_path, args.sample_size, args.max_rows)
    all_records = chakma + garo + marma + meld

    language_texts = []
    language_texts.extend(collect_language_texts(chakma))
    language_texts.extend(collect_language_texts(garo, "Garo"))
    language_texts.extend(collect_language_texts(marma, "Marma"))
    language_texts.extend(collect_language_texts(meld))
    for item in BANGLA_EDU_EXAMPLES:
        language_texts.append((item["question"], "Bangla", "local_bangla_educational_seed"))
        language_texts.append((item["answer"], "Bangla", "local_bangla_educational_seed"))

    language_detection = make_detection_examples(language_texts)
    chakma_instruction = make_target_instruction_examples(chakma + meld, "Chakma", ("Bangla", "English"))
    garo_instruction = make_target_instruction_examples(garo + meld, "Garo", ("Bangla", "English"))
    marma_instruction = make_target_instruction_examples(marma + meld, "Marma", ("Bangla", "English"))
    bangla_instruction = make_bangla_instruction_examples()

    bangla_to_chakma = make_pair_examples(
        chakma + meld,
        "Bangla",
        "Chakma",
        "Translate or explain this Bangla text in Chakma.",
    )
    bangla_to_garo = make_pair_examples(
        all_records,
        "Bangla",
        "Garo",
        "Translate or explain this Bangla text in Garo.",
    )
    bangla_to_marma = make_pair_examples(
        all_records,
        "Bangla",
        "Marma",
        "Translate or explain this Bangla text in Marma.",
    )

    combined = (
        language_detection
        + bangla_instruction
        + chakma_instruction
        + garo_instruction
        + marma_instruction
        + bangla_to_chakma
        + bangla_to_garo
        + bangla_to_marma
    )

    output_dir = Path(args.output_dir)
    write_jsonl(output_dir / OUTPUT_FILES["language_detection"], language_detection)
    write_jsonl(output_dir / OUTPUT_FILES["chakma_instruction"], chakma_instruction)
    write_jsonl(output_dir / OUTPUT_FILES["garo_instruction"], garo_instruction)
    write_jsonl(output_dir / OUTPUT_FILES["marma_instruction"], marma_instruction)
    write_jsonl(output_dir / OUTPUT_FILES["bangla_to_chakma"], bangla_to_chakma)
    write_jsonl(output_dir / OUTPUT_FILES["bangla_to_garo"], bangla_to_garo)
    write_jsonl(output_dir / OUTPUT_FILES["bangla_to_marma"], bangla_to_marma)
    write_jsonl(output_dir / OUTPUT_FILES["combined"], combined)

    if not bangla_to_garo:
        print("Note: bangla_to_garo is empty because no verified Bangla-Garo pairs were found.")
    if not bangla_to_marma:
        print("Note: bangla_to_marma is empty because no verified Bangla-Marma pairs were found.")


if __name__ == "__main__":
    main()
