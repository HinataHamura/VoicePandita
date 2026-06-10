import { NextResponse } from 'next/server'
import { checkOllamaHealth, OLLAMA_DEFAULTS } from '@/lib/ai/ollama'
import { offlineAiEnabled } from '@/lib/offline/offline-ask'

export async function GET() {
  if (!offlineAiEnabled()) {
    return NextResponse.json({
      ok: false,
      enabled: false,
      provider: 'ollama',
      model: process.env.OLLAMA_MODEL || OLLAMA_DEFAULTS.model,
      embeddingModel: process.env.OLLAMA_EMBED_MODEL || OLLAMA_DEFAULTS.embeddingModel,
      error: 'Offline AI mode is disabled.',
    })
  }

  const health = await checkOllamaHealth()
  return NextResponse.json({
    ok: health.ok,
    enabled: true,
    provider: 'ollama',
    model: process.env.OLLAMA_MODEL || OLLAMA_DEFAULTS.model,
    embeddingModel: process.env.OLLAMA_EMBED_MODEL || OLLAMA_DEFAULTS.embeddingModel,
    baseUrl: health.baseUrl,
    error: health.error,
  }, { status: health.ok ? 200 : 503 })
}
