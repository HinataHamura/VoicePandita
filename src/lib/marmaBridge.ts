import { readFile } from 'fs/promises'
import path from 'path'

export type MarmaContext = {
  enabled: boolean
  examples: string[]
  source: 'local-jsonl' | 'hf-dataset' | 'unavailable'
}

type DetectionRow = {
  input?: unknown
  output?: unknown
  source_dataset?: unknown
}

type HfRowsResponse = {
  rows?: Array<{ row?: { sentence?: unknown; normalized?: unknown } }>
}

let contextCache: Promise<MarmaContext> | null = null

function isMyanmarScript(text: string) {
  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0
    if (codePoint >= 0x1000 && codePoint <= 0x109f) return true
  }
  return false
}

export function hasMarmaScript(text: string) {
  return isMyanmarScript(text)
}

function normalizeText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function uniqueExamples(values: string[], limit: number) {
  const seen = new Set<string>()
  return values
    .map(normalizeText)
    .filter(value => value.length >= 8 && isMyanmarScript(value))
    .filter(value => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
    .slice(0, limit)
}

async function loadLocalExamples(limit: number) {
  const filePath = path.join(process.cwd(), 'data', 'language_detection.jsonl')
  const content = await readFile(filePath, 'utf8')
  const examples = content
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      try {
        const row = JSON.parse(line) as DetectionRow
        return row.output === 'Marma' ? [normalizeText(row.input)] : []
      } catch {
        return []
      }
    })

  return uniqueExamples(examples, limit)
}

async function loadHfExamples(limit: number) {
  const params = new URLSearchParams({
    dataset: 'CLEAR-Global/marmaspeak-text',
    config: 'default',
    split: 'train',
    offset: '0',
    length: String(Math.max(limit, 20)),
  })
  const res = await fetch(`https://datasets-server.huggingface.co/rows?${params.toString()}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) throw new Error(`Marma HF dataset request failed: ${res.status}`)
  const data = await res.json() as HfRowsResponse
  const examples = (data.rows || []).map(item => normalizeText(item.row?.normalized || item.row?.sentence))
  return uniqueExamples(examples, limit)
}

export async function loadMarmaContext(limit = 16): Promise<MarmaContext> {
  contextCache ??= (async () => {
    try {
      const examples = await loadLocalExamples(limit)
      if (examples.length) return { enabled: true, examples, source: 'local-jsonl' as const }
    } catch {
      // The committed JSONL is optional at runtime; fall through to Hugging Face.
    }

    try {
      const examples = await loadHfExamples(limit)
      if (examples.length) return { enabled: true, examples, source: 'hf-dataset' as const }
    } catch (err) {
      console.warn('Marma dataset unavailable', err instanceof Error ? err.message : err)
    }

    return { enabled: false, examples: [], source: 'unavailable' as const }
  })()

  return contextCache
}

export function formatMarmaExamples(examples: string[]) {
  return examples.map((example, index) => `${index + 1}. ${example}`).join('\n')
}
