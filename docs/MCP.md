# VoicePandita MCP Server

VoicePandita includes a small dependency-free MCP-style stdio server for project context, data provenance, AI-DLC notes, native-language reporting, and RAG architecture summaries.

## Server Built

```text
voicepandita-mcp
```

File:

```text
mcp/voicepandita_server.py
```

Transport:

```text
stdio with Content-Length JSON-RPC framing
```

## Tools Exposed

| Tool | Purpose |
| --- | --- |
| `voicepandita_project_overview` | Summarizes project features, pages, and API surfaces. |
| `voicepandita_native_language_report` | Reports Chakma, Marma, and Garo support with local dataset counts. |
| `voicepandita_ai_dlc_report` | Summarizes AGENTS.md and AI-DLC process. |
| `voicepandita_rag_report` | Summarizes contextual RAG, semantic chunking, vector search, PWN, and Neo4j memory. |

## Smoke Test

```bash
python mcp/smoke_client.py
```

Expected output includes:

- server name/version
- list of four MCP tools
- sample native-language report lines

## Example MCP Host Config

For MCP hosts that support stdio servers, use:

```json
{
  "mcpServers": {
    "voicepandita": {
      "command": "python",
      "args": ["mcp/voicepandita_server.py"],
      "cwd": "E:/VoicePandita"
    }
  }
}
```

## BuildFest Form Notes

MCP servers built:

```text
VoicePandita Project Context MCP
VoicePandita Native Language Provenance MCP tools
VoicePandita RAG / AI-DLC Reporting MCP tools
```

MCP servers used:

```text
Used our local VoicePandita MCP server through the included stdio smoke client.
```

MCP clients / hosts:

```text
Custom stdio smoke client in mcp/smoke_client.py; compatible with MCP stdio hosts such as Claude Desktop, Cursor, or Cline-style MCP clients.
```

MCP reuse / architecture notes:

```text
The MCP server exposes reusable project-context tools over stdio. It lets AI assistants retrieve VoicePandita project overview, native-language provenance, AI-DLC process, and RAG architecture without scraping README manually. The server is dependency-free Python and uses Content-Length JSON-RPC framing, so it can be reused by MCP-compatible hosts or the included smoke client.
```
