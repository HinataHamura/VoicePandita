#!/usr/bin/env python3
"""Smoke-test client for the VoicePandita MCP stdio server."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "mcp" / "voicepandita_server.py"


def frame(message: dict[str, Any]) -> bytes:
    payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
    return f"Content-Length: {len(payload)}\r\n\r\n".encode("ascii") + payload


def read_message(proc: subprocess.Popen[bytes]) -> dict[str, Any]:
    headers: dict[str, str] = {}
    while True:
        line = proc.stdout.readline()
        if not line:
            raise RuntimeError("server closed stdout")
        line = line.decode("utf-8").strip()
        if not line:
            break
        key, value = line.split(":", 1)
        headers[key.lower()] = value.strip()
    length = int(headers["content-length"])
    payload = proc.stdout.read(length)
    return json.loads(payload.decode("utf-8"))


def send(proc: subprocess.Popen[bytes], message: dict[str, Any]) -> dict[str, Any]:
    proc.stdin.write(frame(message))
    proc.stdin.flush()
    return read_message(proc)


def main() -> None:
    proc = subprocess.Popen(
        [sys.executable, str(SERVER)],
        cwd=str(ROOT),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdin and proc.stdout
    try:
        init = send(proc, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        tools = send(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        report = send(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {"name": "voicepandita_native_language_report", "arguments": {}},
            },
        )
        print(json.dumps(
            {
                "server": init["result"]["serverInfo"],
                "tools": [tool["name"] for tool in tools["result"]["tools"]],
                "sample": report["result"]["content"][0]["text"].splitlines()[:6],
            },
            ensure_ascii=False,
            indent=2,
        ))
    finally:
        proc.kill()


if __name__ == "__main__":
    main()
