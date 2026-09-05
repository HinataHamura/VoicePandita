import fs from 'node:fs'
import path from 'node:path'

import chakmaBridgeRows from '@/data/chakma/chakmaBridge.json'
import type { LearnerLanguage } from './types'

export type NormalizedLocalizationRow = {
  english: string
  standardBangla: string
  chakmaBengaliScript: string
  garoBengaliScript: string
  marmaBengaliScript: string
  source: string
}

export type LocalBridgeMatch = {
  text: string
  confidence: number
  provenance: 'verified-dataset' | 'local-bridge'
  matchedField: 'standardBangla' | 'english'
  source: string
}

type LowResourceLanguage = Extract<LearnerLanguage, 'chakma' | 'garo' | 'marma'>

const POSSIBLE_BRIDGE_PATHS = [
  path.join(process.cwd(), 'data', 'multilingual', 'localization-bridge.jsonl'),
  path.join(process.cwd(), 'data', 'multilingual', 'localization-bridge.json'),
  path.join(process.cwd(), 'data', 'multilingual', 'bengali-script-local-bridge.jsonl'),
  path.join(process.cwd(), 'data', 'multilingual', 'bengali-script-local-bridge.json'),
]

const BENGALI_RANGE = /[\u0980-\u09FF]/

function clean(value: unknown) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim()
}

function normalizeSearchText(value: string) {
  return clean(value).toLowerCase().replace(/[।.,!?;:"'(){}\[\]`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(token => token.length > 1)
}

function jaccard(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  let intersection = 0
  for (const token of Array.from(leftSet)) {
    if (rightSet.has(token)) intersection += 1
  }
  return intersection / new Set([...Array.from(leftSet), ...Array.from(rightSet)]).size
}

function stringField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = clean(row[key])
    if (value) return value
  }
  return ''
}

function parseObjectRow(value: unknown, source: string): NormalizedLocalizationRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const normalized: NormalizedLocalizationRow = {
    english: stringField(row, ['english', 'English', 'en']),
    standardBangla: stringField(row, ['standardBangla', 'standard bangla', 'standard_bangla', 'bangla', 'Bangla', 'bn']),
    chakmaBengaliScript: stringField(row, ['chakmaBengaliScript', 'chakma_bengali_script', 'chakma', 'Chakma']),
    garoBengaliScript: stringField(row, ['garoBengaliScript', 'garo_bengali_script', 'garo', 'Garo']),
    marmaBengaliScript: stringField(row, ['marmaBengaliScript', 'marma_bengali_script', 'marma', 'Marma']),
    source,
  }

  if (!normalized.english && !normalized.standardBangla) return null
  if (!normalized.chakmaBengaliScript && !normalized.garoBengaliScript && !normalized.marmaBengaliScript) return null
  return normalized
}

function loadRowsFromFile(filePath: string): NormalizedLocalizationRow[] {
  if (!fs.existsSync(filePath)) return []
  const source = path.relative(process.cwd(), filePath)
  const content = fs.readFileSync(filePath, 'utf8').trim()
  if (!content) return []

  if (filePath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content)
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : []
      return rows.map((row: unknown) => parseObjectRow(row, source)).filter((row: NormalizedLocalizationRow | null): row is NormalizedLocalizationRow => Boolean(row))
    } catch {
      return []
    }
  }

  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return parseObjectRow(JSON.parse(line), source)
      } catch {
        return null
      }
    })
    .filter((row): row is NormalizedLocalizationRow => Boolean(row))
}

function loadChakmaBengaliBridgeRows(): NormalizedLocalizationRow[] {
  if (!Array.isArray(chakmaBridgeRows)) return []

  return (chakmaBridgeRows as Array<Record<string, unknown>>)
    .map(row => parseObjectRow({
      english: row.english,
      standardBangla: row.bangla,
      chakmaBengaliScript: row.bengaliScriptChakma,
    }, 'src/data/chakma/chakmaBridge.json'))
    .filter((row): row is NormalizedLocalizationRow => Boolean(row))
}

export function loadNormalizedLocalizationRows() {
  const fileRows = POSSIBLE_BRIDGE_PATHS.flatMap(loadRowsFromFile)
  return [...fileRows, ...loadChakmaBengaliBridgeRows()]
}

function targetValue(row: NormalizedLocalizationRow, language: LowResourceLanguage) {
  if (language === 'chakma') return row.chakmaBengaliScript
  if (language === 'garo') return row.garoBengaliScript
  return row.marmaBengaliScript
}

function scoreCandidate(sourceText: string, query: string) {
  const normalizedSource = normalizeSearchText(sourceText)
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedSource || !normalizedQuery) return 0
  if (normalizedSource === normalizedQuery) return 1
  if (normalizedQuery.includes(normalizedSource) || normalizedSource.includes(normalizedQuery)) {
    return Math.min(0.92, normalizedSource.length / Math.max(normalizedQuery.length, normalizedSource.length) + 0.25)
  }
  return jaccard(tokenize(normalizedSource), tokenize(normalizedQuery))
}

export function findBengaliScriptBridgeMatch(params: {
  standardBangla: string
  english?: string | null
  targetLanguage: LearnerLanguage
}): LocalBridgeMatch | null {
  const language = params.targetLanguage
  if (language !== 'chakma' && language !== 'garo' && language !== 'marma') return null

  let best: (LocalBridgeMatch & { rawScore: number }) | null = null

  for (const row of loadNormalizedLocalizationRows()) {
    const target = targetValue(row, language)
    if (!target || !BENGALI_RANGE.test(target)) continue

    const banglaScore = scoreCandidate(row.standardBangla, params.standardBangla)
    const englishScore = params.english ? scoreCandidate(row.english, params.english) : 0
    const rawScore = Math.max(banglaScore, englishScore)
    if (rawScore < 0.68) continue

    const confidence = rawScore >= 0.99 ? 0.98 : rawScore >= 0.82 ? 0.82 : 0.7
    const provenance: LocalBridgeMatch['provenance'] = row.source.includes('src/data/chakma/chakmaBridge.json')
      ? 'local-bridge'
      : 'verified-dataset'
    const candidate = {
      text: target,
      confidence,
      provenance,
      matchedField: banglaScore >= englishScore ? 'standardBangla' as const : 'english' as const,
      source: row.source,
      rawScore,
    }
    if (!best || candidate.rawScore > best.rawScore) best = candidate
  }

  if (!best) return null
  const { rawScore: _rawScore, ...match } = best
  return match
}
