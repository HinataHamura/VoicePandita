import fs from 'node:fs'
import path from 'node:path'

export type LanguageExampleScript = 'bengali' | 'latin' | 'native'
export type LanguageExampleSource = 'chakmabridge' | 'meld' | 'pos' | 'manual'
export type LanguageExampleTaskType = 'translation' | 'transliteration' | 'qa_example' | 'pos_auxiliary'

export type LanguageExample = {
  source_text: string
  source_language: string
  source_script: string
  target_language: string
  target_script: LanguageExampleScript
  target_text: string
  dataset_source: LanguageExampleSource
  task_type: LanguageExampleTaskType
}

const LANGUAGE_EXAMPLES_DIR = path.join(process.cwd(), 'src', 'data', 'language-examples')
const TODO_PATTERN = /\bTODO\b/i

const LANGUAGE_ALIASES: Record<string, string> = {
  ccp: 'chakma',
  ckm: 'chakma',
  chakma: 'chakma',
  gnk: 'garo',
  grt: 'garo',
  garo: 'garo',
  mrm: 'marma',
  marma: 'marma',
}

function normalizeLanguage(value: unknown) {
  const key = String(value || '').trim().toLowerCase()
  return LANGUAGE_ALIASES[key] || key
}

function normalizeScript(value: unknown): LanguageExampleScript | null {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'bengali' || key === 'bangla') return 'bengali'
  if (key === 'latin' || key === 'roman' || key === 'romanized') return 'latin'
  if (key === 'native' || key === 'chakma' || key === 'chakma-native' || key === 'myanmar') return 'native'
  return null
}

function isLanguageExampleSource(value: unknown): value is LanguageExampleSource {
  return value === 'chakmabridge' || value === 'meld' || value === 'pos' || value === 'manual'
}

function isLanguageExampleTaskType(value: unknown): value is LanguageExampleTaskType {
  return value === 'translation' || value === 'transliteration' || value === 'qa_example' || value === 'pos_auxiliary'
}

function parseLanguageExample(value: unknown): LanguageExample | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>
  const targetScript = normalizeScript(row.target_script)
  const datasetSource = row.dataset_source
  const taskType = row.task_type

  if (
    typeof row.source_text !== 'string' ||
    typeof row.source_language !== 'string' ||
    typeof row.source_script !== 'string' ||
    typeof row.target_language !== 'string' ||
    !targetScript ||
    typeof row.target_text !== 'string' ||
    !isLanguageExampleSource(datasetSource) ||
    !isLanguageExampleTaskType(taskType)
  ) {
    return null
  }

  const example: LanguageExample = {
    source_text: row.source_text.trim(),
    source_language: normalizeLanguage(row.source_language),
    source_script: String(row.source_script).trim().toLowerCase(),
    target_language: normalizeLanguage(row.target_language),
    target_script: targetScript,
    target_text: row.target_text.trim(),
    dataset_source: datasetSource,
    task_type: taskType,
  }

  if (
    !example.source_text ||
    !example.target_text ||
    TODO_PATTERN.test(example.source_text) ||
    TODO_PATTERN.test(example.target_text)
  ) {
    return null
  }

  return example
}

export function loadLanguageExamples(dirPath = LANGUAGE_EXAMPLES_DIR): LanguageExample[] {
  try {
    return fs.readdirSync(dirPath)
      .filter(fileName => fileName.endsWith('.jsonl'))
      .flatMap(fileName => {
        const filePath = path.join(dirPath, fileName)
        return fs.readFileSync(filePath, 'utf8')
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            try {
              return parseLanguageExample(JSON.parse(line))
            } catch {
              return null
            }
          })
          .filter((row): row is LanguageExample => Boolean(row))
      })
  } catch {
    return []
  }
}

export function getLanguageExamples(
  selectedLanguage: string,
  outputScript: string,
  limit = 4,
): LanguageExample[] {
  const language = normalizeLanguage(selectedLanguage)
  const script = normalizeScript(outputScript)
  if (!language || !script || limit <= 0) return []

  return loadLanguageExamples()
    .filter(row => row.target_language === language && row.target_script === script)
    .slice(0, limit)
}

export function formatLanguageExamples(rows: LanguageExample[]) {
  if (!rows.length) return 'No dataset examples are available for this language/script pair.'

  return rows
    .map(row => [
      `Source (${row.source_language}/${row.source_script}): ${row.source_text}`,
      `Target (${row.target_language}/${row.target_script}): ${row.target_text}`,
      `Dataset source: ${row.dataset_source}; task: ${row.task_type}`,
    ].join('\n'))
    .join('\n\n')
}
