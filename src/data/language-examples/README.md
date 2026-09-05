# Language Examples JSONL Schema

Rows in this folder are JSONL-compatible: one JSON object per line.

```json
{
  "source_text": "",
  "source_language": "",
  "source_script": "",
  "target_language": "chakma",
  "target_script": "bengali|latin|native",
  "target_text": "",
  "dataset_source": "chakmabridge|meld|pos|manual",
  "task_type": "translation|transliteration|qa_example|pos_auxiliary"
}
```

Notes:

- Do not add invented Chakma, Garo, or Marma translations.
- Placeholder rows must include `TODO` text and are ignored by the prompt loader.
- Prefer verified dataset provenance in `dataset_source` when real files are added.
