#!/usr/bin/env python3
"""VoicePandita dataset and provenance MCP server."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from mcp_stdio import serve


ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.0"


def count_lines(path: Path) -> int | str:
    if not path.exists():
        return "missing"
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def count_json(path: Path) -> int | str:
    if not path.exists():
        return "missing"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return f"error: {exc}"
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        return len(data)
    return type(data).__name__


def count_files(root: Path, suffix: str) -> int | str:
    if not root.exists():
        return "missing"
    return sum(1 for item in root.rglob(f"*{suffix}") if item.is_file())


def dataset_inventory(_: dict[str, Any]) -> str:
    rows = [
        ("Chakma app cache", "src/data/chakmaPairs.json", count_json(ROOT / "src/data/chakmaPairs.json")),
        ("Bangla to Chakma JSONL", "data/bangla_to_chakma_instruction.jsonl", count_lines(ROOT / "data/bangla_to_chakma_instruction.jsonl")),
        ("Bangla to Garo JSONL", "data/bangla_to_garo_instruction.jsonl", count_lines(ROOT / "data/bangla_to_garo_instruction.jsonl")),
        ("Bangla to Marma JSONL", "data/bangla_to_marma_instruction.jsonl", count_lines(ROOT / "data/bangla_to_marma_instruction.jsonl")),
        ("IsharaKotha SiGML files", "public/data/Sections/**/*.sigml", count_files(ROOT / "public/data/Sections", ".sigml")),
        ("IsharaKotha dataset index", "public/data/Sections/dataset.json", count_json(ROOT / "public/data/Sections/dataset.json")),
        ("Docs config", "data/docs-config.json", count_json(ROOT / "data/docs-config.json")),
        ("Supabase schema", "supabase/schema.sql", "present" if (ROOT / "supabase/schema.sql").exists() else "missing"),
    ]
    lines = ["VoicePandita dataset/provenance inventory:"]
    for name, path, count in rows:
        lines.append(f"- {name}: {path} -> {count}")
    return "\n".join(lines)


def provenance_report(_: dict[str, Any]) -> str:
    return """VoicePandita AI/data provenance:

- Student auth, profile, chat history, docs config, curriculum memory, and PWN storage use Supabase tables/RPCs where configured.
- Vector/RAG data is seeded through scripts/seed_curriculum.py and Supabase pgvector SQL scripts.
- Graph memory is written through src/app/api/graph-memory/route.ts to Neo4j when NEO4J_* env vars exist.
- Native-language work uses local JSON/JSONL artifacts plus branch-specific app code for Chakma, Marma, and Garo support.
- BdSL avatar assets are local SiGML files under public/data/Sections and manifest/index files in the same tree.
- Missing provider keys trigger explicit fallbacks rather than silent provider calls."""


def bdsl_asset_report(_: dict[str, Any]) -> str:
    sigml_count = count_files(ROOT / "public/data/Sections", ".sigml")
    folders = count_json(ROOT / "public/data/Sections/folders.json")
    dataset = count_json(ROOT / "public/data/Sections/dataset.json")
    return f"""BdSL/IsharaKotha asset status:

- SiGML file count: {sigml_count}
- Folder index entries: {folders}
- Dataset index entries: {dataset}
- Runtime consumer: src/components/BdslAvatar.tsx
- Parser/helper: src/lib/bdsl/sigmlParser.ts
- Purpose: expose local sign assets to the avatar pipeline and let an AI client audit whether sign coverage exists before claiming full BdSL support."""


TOOLS = {
    "voicepandita_dataset_inventory": {
        "description": "Count and summarize local datasets, JSONL files, Supabase scripts, and BdSL assets.",
        "handler": dataset_inventory,
    },
    "voicepandita_provenance_report": {
        "description": "Summarize where data comes from, where it is stored, and which integrations own it.",
        "handler": provenance_report,
    },
    "voicepandita_bdsl_asset_report": {
        "description": "Report local IsharaKotha/BdSL SiGML asset coverage and runtime consumers.",
        "handler": bdsl_asset_report,
    },
}


if __name__ == "__main__":
    serve(server_name="voicepandita-data-mcp", version=VERSION, tools=TOOLS)
