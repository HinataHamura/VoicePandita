import { NextResponse } from 'next/server'
import { readDocsConfig } from '@/lib/docs/store'
import { isDocsVisible } from '@/lib/docs/defaults'

export const dynamic = 'force-dynamic'

const exposedApis = [
  '/api/ask',
  '/api/transcribe',
  '/api/ocr',
  '/api/embeddings',
  '/api/curriculum-memory',
  '/api/graph-memory',
  '/api/pwn',
  '/api/bdsl-translate',
]

const features = [
  'Bangla voice tutor',
  'Visual concept maps',
  'Emotion-aware support',
  'GraphRAG memory',
  'Peer Wisdom Network',
  'Offline packs',
  'Chakma/Marma/Garo',
  'BdSL avatar',
]

export async function GET() {
  const config = await readDocsConfig()
  return NextResponse.json({
    docsStatus: isDocsVisible(config) ? 'Public' : 'Restricted',
    apiCount: exposedApis.length,
    featureCount: features.length,
    lastCheckedAt: new Date().toISOString(),
  })
}
