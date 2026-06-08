import fs from 'node:fs'
import path from 'node:path'

import type { LearnerLanguage, LearnerScript } from './types'

export type ParallelDatasetRow = {
  id: string
  language: Exclude<LearnerLanguage, 'bn' | 'en' | 'unknown'>
  script: Extract<LearnerScript, 'bengali' | 'latin' | 'chakma' | 'myanmar'>
  domain: string
  grade: string | number | null
  subject: string | null
  bn: string
  target: string
  source: string
  verified: boolean
  license: string
}

const SAMPLE_PARALLEL_PATH = path.join(process.cwd(), 'data', 'multilingual', 'sample-parallel.jsonl')

function isSupportedLanguage(value: unknown): value is ParallelDatasetRow['language'] {
  return value === 'chakma' || value === 'garo' || value === 'marma'
}

function isSupportedScript(value: unknown): value is ParallelDatasetRow['script'] {
  return value === 'bengali' || value === 'latin' || value === 'chakma' || value === 'myanmar'
}

function parseRow(value: unknown): ParallelDatasetRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (
    typeof row.id !== 'string' ||
    !isSupportedLanguage(row.language) ||
    !isSupportedScript(row.script) ||
    typeof row.domain !== 'string' ||
    typeof row.bn !== 'string' ||
    typeof row.target !== 'string' ||
    typeof row.source !== 'string' ||
    typeof row.verified !== 'boolean' ||
    typeof row.license !== 'string'
  ) {
    return null
  }

  return {
    id: row.id,
    language: row.language,
    script: row.script,
    domain: row.domain,
    grade: typeof row.grade === 'string' || typeof row.grade === 'number' ? row.grade : null,
    subject: typeof row.subject === 'string' ? row.subject : null,
    bn: row.bn,
    target: row.target,
    source: row.source,
    verified: row.verified,
    license: row.license,
  }
}

export function loadSampleParallelRows(filePath = SAMPLE_PARALLEL_PATH): ParallelDatasetRow[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return parseRow(JSON.parse(line))
        } catch {
          return null
        }
      })
      .filter((row): row is ParallelDatasetRow => Boolean(row))
  } catch {
    return []
  }
}

export function selectParallelExamples(params: {
  language: LearnerLanguage
  script: LearnerScript
  domain?: string
  limit?: number
}) {
  const { language, script, domain = 'curriculum', limit = 8 } = params
  if (!isSupportedLanguage(language) || !isSupportedScript(script)) return []

  return loadSampleParallelRows()
    .filter(row => row.language === language && row.script === script && (!domain || row.domain === domain))
    .slice(0, limit)
}

export function formatParallelExamples(rows: ParallelDatasetRow[]) {
  if (!rows.length) return 'No verified parallel examples are available for this language/script pair.'

  return rows
    .map(row => {
      const status = row.verified ? 'verified' : 'unverified demo'
      return `Bangla: ${row.bn}\nTarget: ${row.target}\nSource: ${row.source}; ${status}; license: ${row.license}`
    })
    .join('\n\n')
}
