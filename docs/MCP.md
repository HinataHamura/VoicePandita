# VoicePandita MCP Servers

VoicePandita includes dependency-free MCP-style stdio servers for project context,
dataset provenance, and quality/audit reporting.

## Servers Built

| Server | File | Tools | Purpose |
| --- | --- | ---: | --- |
| `voicepandita-mcp` | `mcp/voicepandita_server.py` | 4 | Project overview, native-language status, AI-DLC notes, and RAG architecture. |
| `voicepandita-data-mcp` | `mcp/voicepandita_data_server.py` | 3 | Dataset inventory, data provenance, and BdSL/IsharaKotha asset coverage. |
| `voicepandita-quality-mcp` | `mcp/voicepandita_quality_server.py` | 4 | API route inventory, env var inventory, TODO/stub scan, and quality snapshot. |

Transport:

```text
stdio with Content-Length JSON-RPC framing
```

Methods implemented:

```text
initialize, tools/list, tools/call
```

Language/SDK:

```text
Python, dependency-free MCP-style JSON-RPC
```

## Tools Exposed

| Tool | Server | Purpose |
| --- | --- | --- |
| `voicepandita_project_overview` | `voicepandita-mcp` | Summarizes project features, pages, and API surfaces. |
| `voicepandita_native_language_report` | `voicepandita-mcp` | Reports Chakma, Marma, and Garo support with local dataset counts. |
| `voicepandita_ai_dlc_report` | `voicepandita-mcp` | Summarizes AGENTS.md and AI-DLC process. |
| `voicepandita_rag_report` | `voicepandita-mcp` | Summarizes contextual RAG, semantic chunking, vector search, PWN, and Neo4j memory. |
| `voicepandita_dataset_inventory` | `voicepandita-data-mcp` | Counts local JSONL/native-language files, Supabase scripts, and BdSL assets. |
| `voicepandita_provenance_report` | `voicepandita-data-mcp` | Summarizes where project data comes from and which systems store/use it. |
| `voicepandita_bdsl_asset_report` | `voicepandita-data-mcp` | Reports local IsharaKotha/SiGML coverage and runtime consumers. |
| `voicepandita_api_route_inventory` | `voicepandita-quality-mcp` | Lists Next.js API routes and exported HTTP methods. |
| `voicepandita_env_inventory` | `voicepandita-quality-mcp` | Lists `process.env.*` variables and referencing files. |
| `voicepandita_todo_inventory` | `voicepandita-quality-mcp` | Finds TODO, FIXME, HACK, and stub markers. |
| `voicepandita_quality_snapshot` | `voicepandita-quality-mcp` | Summarizes API/page/test counts and quality gates. |

## Smoke Test

```bash
python mcp/smoke_client.py
```

Expected output includes:

- all three server names and versions
- list of eleven MCP tools total
- sample output from one tool per server

## Example MCP Host Config

For MCP hosts that support stdio servers, use:

```json
{
  "mcpServers": {
    "voicepandita": {
      "command": "python",
      "args": ["mcp/voicepandita_server.py"],
      "cwd": "E:/VoicePandita"
    },
    "voicepandita-data": {
      "command": "python",
      "args": ["mcp/voicepandita_data_server.py"],
      "cwd": "E:/VoicePandita"
    },
    "voicepandita-quality": {
      "command": "python",
      "args": ["mcp/voicepandita_quality_server.py"],
      "cwd": "E:/VoicePandita"
    }
  }
}
```

## BuildFest Form Notes

MCP servers built:

```text
voicepandita-mcp — 4 tools — stdio — Python — exposes project overview, native-language status, AI-DLC notes, and RAG architecture.
voicepandita-data-mcp — 3 tools — stdio — Python — exposes dataset inventory, provenance, and BdSL/IsharaKotha asset coverage.
voicepandita-quality-mcp — 4 tools — stdio — Python — exposes API route inventory, env var inventory, TODO/stub scan, and quality snapshot.
```

MCP servers used:

```text
Used our local VoicePandita MCP servers through the included stdio smoke client. The client calls initialize, tools/list, and tools/call for each server.
```

MCP clients / hosts:

```text
Custom stdio smoke client in mcp/smoke_client.py; compatible with MCP stdio hosts such as Claude Desktop, Cursor, or Cline-style MCP clients.
```

MCP reuse / architecture notes:

```text
The MCP layer is split by responsibility: project context, dataset provenance, and quality audit. All servers share the small mcp/mcp_stdio.py framing helper and expose reusable tools over stdio. This lets AI assistants retrieve VoicePandita implementation facts, dataset counts, API inventory, env vars, and unresolved stubs without manually scraping README or source files.
```
