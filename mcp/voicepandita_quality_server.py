#!/usr/bin/env python3
"""VoicePandita route, env, and quality audit MCP server."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from mcp_stdio import serve


ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.0"
ROUTE_PATTERN = re.compile(r"export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)")
ENV_PATTERN = re.compile(r"process\.env\.([A-Z0-9_]+)")
TODO_PATTERN = re.compile(r"\b(TODO|FIXME|HACK|stub)\b", re.IGNORECASE)


def text_files() -> list[Path]:
    roots = ["src", "scripts", "docs", "mcp"]
    suffixes = {".ts", ".tsx", ".js", ".mjs", ".py", ".md", ".sql"}
    files: list[Path] = []
    for root_name in roots:
        root = ROOT / root_name
        if not root.exists():
            continue
        files.extend(path for path in root.rglob("*") if path.is_file() and path.suffix in suffixes)
    return files


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def api_route_inventory(_: dict[str, Any]) -> str:
    api_root = ROOT / "src/app/api"
    if not api_root.exists():
        return "No src/app/api directory found."

    lines = ["VoicePandita API route inventory:"]
    for route_file in sorted(api_root.rglob("route.ts")):
        route = "/" + route_file.parent.relative_to(ROOT / "src/app").as_posix()
        text = route_file.read_text(encoding="utf-8", errors="ignore")
        methods = sorted(set(ROUTE_PATTERN.findall(text)))
        lines.append(f"- {route}: {', '.join(methods) if methods else 'no exported HTTP method found'} ({rel(route_file)})")
    return "\n".join(lines)


def env_inventory(_: dict[str, Any]) -> str:
    found: dict[str, set[str]] = {}
    for path in text_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for name in ENV_PATTERN.findall(text):
            found.setdefault(name, set()).add(rel(path))

    if not found:
        return "No process.env.* references found."

    lines = ["VoicePandita environment variable inventory:"]
    for name in sorted(found):
        refs = ", ".join(sorted(found[name])[:6])
        extra = "" if len(found[name]) <= 6 else f" (+{len(found[name]) - 6} more)"
        lines.append(f"- {name}: {refs}{extra}")
    return "\n".join(lines)


def todo_inventory(_: dict[str, Any]) -> str:
    matches: list[str] = []
    for path in text_files():
        for idx, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), start=1):
            if TODO_PATTERN.search(line):
                matches.append(f"- {rel(path)}:{idx}: {line.strip()[:180]}")

    if not matches:
        return "No TODO/FIXME/HACK/stub comments or markers found in scanned text files."
    return "VoicePandita unfinished-code markers:\n" + "\n".join(matches[:80])


def quality_snapshot(_: dict[str, Any]) -> str:
    api_count = len(list((ROOT / "src/app/api").rglob("route.ts"))) if (ROOT / "src/app/api").exists() else 0
    page_count = len(list((ROOT / "src/app").rglob("page.tsx"))) if (ROOT / "src/app").exists() else 0
    test_count = len(list((ROOT / "tests").rglob("*"))) if (ROOT / "tests").exists() else 0
    return f"""VoicePandita quality snapshot:

- API route files: {api_count}
- App page files: {page_count}
- Test files/items under tests/: {test_count}
- Primary smoke path: login/demo -> /learn -> /api/ask -> diagram/animation/chat persistence.
- Known quality gates: API route inventory, env inventory, TODO/stub scan, MCP smoke test, Playwright smoke test when dependencies are installed."""


TOOLS = {
    "voicepandita_api_route_inventory": {
        "description": "List Next.js API routes and exported HTTP methods.",
        "handler": api_route_inventory,
    },
    "voicepandita_env_inventory": {
        "description": "List process.env variables referenced by source, script, docs, and MCP files.",
        "handler": env_inventory,
    },
    "voicepandita_todo_inventory": {
        "description": "Find TODO, FIXME, HACK, and stub markers across scanned project files.",
        "handler": todo_inventory,
    },
    "voicepandita_quality_snapshot": {
        "description": "Summarize route/page/test counts and recommended quality gates.",
        "handler": quality_snapshot,
    },
}


if __name__ == "__main__":
    serve(server_name="voicepandita-quality-mcp", version=VERSION, tools=TOOLS)
