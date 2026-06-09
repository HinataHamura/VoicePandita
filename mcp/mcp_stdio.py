#!/usr/bin/env python3
"""Small dependency-free stdio helpers for VoicePandita MCP-style servers."""

from __future__ import annotations

import json
import sys
from typing import Any, Callable


ToolHandler = Callable[[dict[str, Any]], str]


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


def tool_list(tools: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "description": item["description"],
            "inputSchema": item.get(
                "inputSchema",
                {"type": "object", "properties": {}, "additionalProperties": False},
            ),
        }
        for name, item in tools.items()
    ]


def handle_request(
    request: dict[str, Any],
    *,
    server_name: str,
    version: str,
    tools: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
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
                "serverInfo": {"name": server_name, "version": version},
            },
        }

    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": tool_list(tools)}}

    if method == "tools/call":
        params = request.get("params") or {}
        name = params.get("name")
        arguments = params.get("arguments") or {}
        item = tools.get(name)
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


def serve(*, server_name: str, version: str, tools: dict[str, dict[str, Any]]) -> None:
    while True:
        request = read_message()
        if request is None:
            break
        response = handle_request(request, server_name=server_name, version=version, tools=tools)
        if response is not None:
            write_message(response)
