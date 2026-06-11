import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runOfflineAsk } from '@/lib/offline/offline-ask'

const OfflineAskSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  subject: z.string().trim().max(80).optional(),
  classLevel: z.string().trim().max(20).optional(),
  language: z.string().trim().max(20).optional().default('bn'),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = OfflineAskSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid question লাগবে।', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const result = await runOfflineAsk(parsed.data)
    return NextResponse.json(result, { status: result.usedContext ? 200 : result.error ? 503 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Offline AI unavailable.'
    return NextResponse.json(
      {
        answer: 'Ollama চালু নেই. Terminal এ `ollama run qwen2.5:0.5b` চালাও।',
        provider: 'ollama',
        offline: true,
        model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
        embeddingModel: process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma:300m-qat-q4_0',
        usedContext: false,
        sources: [],
        error: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 503 }
    )
  }
}
