import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type ChakmaBridgeRow = {
  english: string
  bangla: string
  bengaliScriptChakma: string
  romanizedBangla: string
  romanizedChakma: string
}

const SOURCE_URL = 'https://raw.githubusercontent.com/borhanitrash/ChakmaBridge/main/Dataset/ChakmaBridge.csv'
const DEFAULT_CSV_PATH = path.join(process.cwd(), 'src', 'data', 'chakma', 'ChakmaBridge.csv')
const DEFAULT_OUTPUT_PATH = path.join(process.cwd(), 'src', 'data', 'chakma', 'chakmaBridge.json')

const REQUIRED_COLUMNS = {
  english: ['english'],
  bangla: ['standardbangla', 'bangla', 'standardbengali', 'bengali'],
  bengaliScriptChakma: ['chakma', 'bengaliscriptchakma', 'bengaliscriptedchakma'],
  romanizedBangla: ['romanizedbangla', 'romanisedbangla', 'romanizedbengali', 'romanisedbengali'],
  romanizedChakma: ['romanizedchakma', 'romanisedchakma'],
} as const

function argValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeCell(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some(value => value.length > 0)) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some(value => value.length > 0)) rows.push(row)
  return rows
}

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map(normalizeHeader)
  return normalized.findIndex(header => aliases.includes(header))
}

function buildRows(csvText: string) {
  const parsed = parseCsv(csvText)
  const headers = parsed[0]?.map(normalizeCell) || []
  if (!headers.length) throw new Error('ChakmaBridge CSV is empty or missing a header row.')

  const columns = {
    english: findColumn(headers, REQUIRED_COLUMNS.english),
    bangla: findColumn(headers, REQUIRED_COLUMNS.bangla),
    bengaliScriptChakma: findColumn(headers, REQUIRED_COLUMNS.bengaliScriptChakma),
    romanizedBangla: findColumn(headers, REQUIRED_COLUMNS.romanizedBangla),
    romanizedChakma: findColumn(headers, REQUIRED_COLUMNS.romanizedChakma),
  }

  const missing = Object.entries(columns)
    .filter(([, index]) => index < 0)
    .map(([key]) => key)

  if (missing.length) {
    throw new Error(`Missing required ChakmaBridge column(s): ${missing.join(', ')}. Found headers: ${headers.join(' | ')}`)
  }

  const seen = new Set<string>()
  const cleanRows: ChakmaBridgeRow[] = []

  for (const rawRow of parsed.slice(1)) {
    const item: ChakmaBridgeRow = {
      english: normalizeCell(rawRow[columns.english] || ''),
      bangla: normalizeCell(rawRow[columns.bangla] || ''),
      bengaliScriptChakma: normalizeCell(rawRow[columns.bengaliScriptChakma] || ''),
      romanizedBangla: normalizeCell(rawRow[columns.romanizedBangla] || ''),
      romanizedChakma: normalizeCell(rawRow[columns.romanizedChakma] || ''),
    }

    if (!item.english || !item.bangla || !item.bengaliScriptChakma || !item.romanizedBangla || !item.romanizedChakma) {
      continue
    }

    const key = JSON.stringify(item)
    if (seen.has(key)) continue
    seen.add(key)
    cleanRows.push(item)
  }

  return { headers, rows: cleanRows }
}

async function readCsv(csvPath: string, allowDownload: boolean) {
  try {
    return {
      source: csvPath,
      text: await readFile(csvPath, 'utf8'),
    }
  } catch (err) {
    if (!allowDownload) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`ChakmaBridge CSV not found at ${csvPath}. ${reason}`)
    }
  }

  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`ChakmaBridge CSV not found at ${csvPath}, and download failed with HTTP ${response.status}.`)
  }

  return {
    source: SOURCE_URL,
    text: await response.text(),
  }
}

async function main() {
  const csvPath = path.resolve(argValue('--csv') || DEFAULT_CSV_PATH)
  const outputPath = path.resolve(argValue('--out') || DEFAULT_OUTPUT_PATH)
  const allowDownload = !hasFlag('--no-download')
  const { source, text } = await readCsv(csvPath, allowDownload)
  const { headers, rows } = buildRows(text)

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')

  process.stdout.write(JSON.stringify({
    source,
    outputPath,
    headers,
    rowCount: rows.length,
    samples: rows.slice(0, 3),
  }, null, 2))
  process.stdout.write('\n')
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`prepare-chakma-bridge failed: ${message}\n`)
  process.exitCode = 1
})
