#!/usr/bin/env python3
"""
VoicePandita MCP server.

Dependency-free stdio MCP-style server for project context, provenance, and
native-language reporting. It implements enough of the Model Context Protocol
JSON-RPC surface for MCP hosts and local smoke tests:

- initialize
- tools/list
- tools/call

Transport: stdio with Content-Length framing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def read_message() -> dict[str, Any] | None:
    headers: dict[str, str] = {}

    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        line = line.decode("utf-8").strip()
        if not line:
            break
        if ":" in line:
            key, value = line.split(":", 1)
            headers[key.lower()] = value.strip()

    length = int(headers.get("content-length", "0"))
    if length <= 0:
        return None
    payload = sys.stdin.buffer.read(length)
    return json.loads(payload.decode("utf-8"))


def write_message(message: dict[str, Any]) -> None:
    payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(payload)}\r\n\r\n".encode("ascii"))
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()


def count_json_array(path: Path) -> int | str:
    if not path.exists():
        return "missing"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return len(data) if isinstance(data, list) else "not-array"
    except Exception as exc:
        return f"error: {exc}"


def count_lines(path: Path) -> int | str:
    if not path.exists():
        return "missing"
    return sum(1 for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def project_overview(_: dict[str, Any]) -> str:
    return """VoicePandita is a Bangladesh-first AI tutor with Bangla voice/text/image input, Gemini/Groq answer generation, Mermaid diagrams, teaching animations, Supabase pgvector memory/search, Peer Wisdom Network question clustering, and Neo4j graph-memory writes.

Main surfaces:
- /learn: main tutor UI
- /api/ask: tutor answer generation and language routing
- /api/transcribe: Groq Whisper STT
- /api/ocr: Gemini Vision OCR
- /api/embeddings: local embedding server or deterministic fallback
- /api/pwn: anonymous confusion hotspot storage/fetch
- /api/graph-memory: Neo4j question-answer-concept graph writes
"""


def native_language_report(_: dict[str, Any]) -> str:
    chakma_pairs = count_json_array(ROOT / "src" / "data" / "chakmaPairs.json")
    bangla_to_chakma = count_lines(ROOT / "data" / "bangla_to_chakma_instruction.jsonl")
    bangla_to_garo = count_lines(ROOT / "data" / "bangla_to_garo_instruction.jsonl")
    bangla_to_marma = count_lines(ROOT / "data" / "bangla_to_marma_instruction.jsonl")

    return f"""VoicePandita native-language status:

Chakma:
- Strongest native-script support.
- Local app cache: src/data/chakmaPairs.json
- Local pair count: {chakma_pairs}
- Instruction sample rows: data/bangla_to_chakma_instruction.jsonl = {bangla_to_chakma}
- Script detection: Chakma Unicode U+11100-U+1114F
- Bridge: verified pair matching, phrase replacement, and character fallback.

Marma:
- Myanmar-script oriented support.
- Runtime file: src/lib/marmaBridge.ts
- Source configured: CLEAR-Global/marmaspeak-text
- Script detection: Myanmar U+1000-U+109F
- Verified Bangla-Marma paired instruction rows currently: {bangla_to_marma}

Garo:
- Latin-script A.chik/Garo-style support.
- Source configured in ML builder: MWirelabs/garo-english-parallel-corpus
- Detection uses Garo hint words.
- Verified Bangla-Garo paired instruction rows currently: {bangla_to_garo}

Model pipeline:
- ml/finetune_lora.py supports Qwen/Qwen2.5-1.5B-Instruct LoRA/QLoRA.
- ml/inference.py supports local adapter inference via VP_BASE_MODEL and VP_LORA_ADAPTER.
- Safety prompt says not to invent fake Chakma, Garo, or Marma words."""


def ai_dlc_report(_: dict[str, Any]) -> str:
    return """VoicePandita uses a custom AGENTS.md Spec + Memory Bank AI-DLC.

Artifacts:
- AGENTS.md defines Product, Architecture, AI, Data, Frontend, and QA agent roles.
- docs/AI_DLC.md documents spec, design, implement, evaluate, document, and review phases.
- README.md, SQL scripts, ML scripts, and JSONL datasets act as memory-bank artifacts.

Review gates:
- data/model provenance
- privacy and secret handling
- fallback behavior
- low-resource language safety
- implemented vs branch-specific vs prototype vs roadmap claim hygiene"""


def rag_report(_: dict[str, Any]) -> str:
    return """VoicePandita RAG architecture:

- Contextual RAG: curriculum chunks can include contextual_summary and context_text.
- Variable/semantic chunking: scripts/seed_curriculum.py chunks curriculum by sentence/topic with token counts.
- Vector retrieval: Supabase pgvector search_curriculum RPC with 384-dimensional embeddings.
- Embedding path: local FastAPI sentence-transformers server or deterministic fallback embedding.
- Graph memory: /api/graph-memory writes Question, Answer, Concept nodes and ANSWERED_BY/ABOUT/HAS_CHILD relationships to Neo4j.
- PWN retrieval: /api/pwn reads Supabase question clusters and returns common confusion hotspots."""


TOOLS = {
    "voicepandita_project_overview": {
        "description": "Summarize implemented VoicePandita project features and API surfaces.",
        "handler": project_overview,
    },
    "voicepandita_native_language_report": {
        "description": "Report Chakma, Marma, and Garo native-language support with local counts.",
        "handler": native_language_report,
    },
    "voicepandita_ai_dlc_report": {
        "description": "Summarize the project AI-DLC / AGENTS.md workflow.",
        "handler": ai_dlc_report,
    },
    "voicepandita_rag_report": {
        "description": "Summarize RAG, contextual chunking, vector search, and graph memory.",
        "handler": rag_report,
    },
}


def tool_list() -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "description": item["description"],
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        }
        for name, item in TOOLS.items()
    ]


def handle_request(request: dict[str, Any]) -> dict[str, Any] | None:
    request_id = request.get("id")
    method = request.get("method")

    if method == "notifications/initialized":
        return None

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "voicepandita-mcp", "version": "0.1.0"},
            },
        }

    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": tool_list()}}

    if method == "tools/call":
        params = request.get("params") or {}
        name = params.get("name")
        arguments = params.get("arguments") or {}
        item = TOOLS.get(name)
        if not item:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32602, "message": f"Unknown tool: {name}"},
            }
        text = item["handler"](arguments)
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {"content": [{"type": "text", "text": text}]},
        }

    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    }


def main() -> None:
    while True:
        request = read_message()
        if request is None:
            break
        response = handle_request(request)
        if response is not None:
            write_message(response)


if __name__ == "__main__":
    main()
