# Multilingual Demo Dataset

`sample-parallel.jsonl` contains tiny placeholder rows for Phase 2 answer localization tests and prompt context.

Each JSONL row follows this schema:

```json
{
  "id": "demo-1",
  "language": "chakma",
  "script": "latin",
  "domain": "curriculum",
  "grade": null,
  "subject": null,
  "bn": "Standard Bangla sentence",
  "target": "Romanized target-language sentence",
  "source": "manual",
  "verified": false,
  "license": "demo-only"
}
```

Current status:

- **Prototype/demo**: The rows are intentionally tiny manual placeholders.
- **Verified**: `false` for every row.
- **License**: `demo-only`.

These examples are not a production translation dataset. They must not be used to claim verified Chakma, Garo, or Marma translation quality.
