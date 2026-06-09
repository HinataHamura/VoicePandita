# Offline Mode Roadmap

## Implemented MVP

VoicePandita now has a lightweight Offline Learning Mode for demos:

- Browser network detection through `navigator.onLine`.
- Local curriculum cache under `public/offline-data/`.
- Keyword, fuzzy, and transliterated Bangla matching.
- Cached answer builder with simple Mermaid concept map.
- Browser speech synthesis for Bangla-friendly TTS.
- Local history storage plus `pending_sync_queue` for online sync.
- PWN and Graph Memory writes are skipped while offline.

This is not a local LLM. It is a reliable cached curriculum assistant for common SSC/HSC questions.

## Future Extensions

These are planned only and are not implemented in the MVP:

- **Gemma 2B local reasoning:** small local model for richer offline explanations.
- **llama.cpp:** native quantized model runtime for laptop or lab deployments.
- **Whisper.cpp:** offline speech-to-text for voice questions without network.
- **FAISS or local vector index:** full local semantic retrieval over curriculum packs.
- **Ethnic language packs:** offline Chakma, Marma, and Garo verified phrase/curriculum packs.
- **Full offline GraphRAG:** local graph memory and graph traversal without Supabase or Neo4j.

## Guardrails

- No raw audio should be stored offline longer than needed.
- No service role key should ever be exposed to the browser.
- Low-resource language output must use verified packs or clearly fall back to Bangla.
- Online mode should remain the default when internet is available.
