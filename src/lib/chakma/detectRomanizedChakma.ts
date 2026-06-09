import { loadChakmaBridgeDataset } from '@/lib/chakmaBridgeDataset'

export type DetectedChakmaLanguage =
  | 'romanized_chakma'
  | 'native_chakma'
  | 'bengali_script_chakma'
  | 'bangla'
  | 'english'
  | 'unknown'

export type RomanizedChakmaDetection = {
  language: DetectedChakmaLanguage
  confidence: number
  reason: string
  matchedTokens: string[]
}

const NATIVE_CHAKMA_START = 0x11100
const NATIVE_CHAKMA_END = 0x1114F
const BENGALI_START = 0x0980
const BENGALI_END = 0x09FF

const COMMON_ROMANIZED_CHAKMA_HINTS = new Set([
  'mui',
  'tui',
  'buji',
  'noyarong',
  'or',
  'mor',
  'tor',
  'thas',
  'thach',
  'hudu',
  'parong',
  'noparong',
  'nang',
  'nangaan',
  'aro',
])

const PUNCTUATION_PATTERN = /[।?!,;:"'‘’“”()[\]{}\-–—./\\]+/g
const LATIN_PATTERN = /[A-Za-z]/

function normalizeText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(PUNCTUATION_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string) {
  return normalizeText(value).split(' ').filter(Boolean)
}

function uniqueTokens(value: string) {
  return Array.from(new Set(tokenize(value)))
}

function containsCodePointInRange(text: string, start: number, end: number) {
  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0
    if (codePoint >= start && codePoint <= end) return true
  }
  return false
}

function containsNativeChakma(text: string) {
  return containsCodePointInRange(text, NATIVE_CHAKMA_START, NATIVE_CHAKMA_END)
}

function containsBanglaScript(text: string) {
  return containsCodePointInRange(text, BENGALI_START, BENGALI_END)
}

function tokenSimilarity(inputTokens: string[], phraseTokens: string[]) {
  if (!inputTokens.length || !phraseTokens.length) return 0

  const phraseTokenSet = new Set(phraseTokens)
  const overlap = inputTokens.filter(token => phraseTokenSet.has(token)).length

  return (2 * overlap) / (inputTokens.length + phraseTokenSet.size)
}

function bestPhraseSimilarity(inputTokens: string[], phrases: string[]) {
  let bestScore = 0

  for (const phrase of phrases) {
    const score = tokenSimilarity(inputTokens, uniqueTokens(phrase))
    if (score > bestScore) bestScore = score
  }

  return bestScore
}

function buildTokenSet(phrases: string[]) {
  const tokens = new Set<string>()

  phrases.forEach(phrase => {
    uniqueTokens(phrase).forEach(token => tokens.add(token))
  })

  return tokens
}

const chakmaBridgeRows = loadChakmaBridgeDataset()
const romanizedChakmaPhrases = chakmaBridgeRows.map(row => row.romanizedChakma).filter(Boolean)
const bengaliScriptChakmaPhrases = chakmaBridgeRows.map(row => row.bengaliScriptChakma).filter(Boolean)
const romanizedChakmaDatasetTokens = buildTokenSet(romanizedChakmaPhrases)
const bengaliScriptChakmaDatasetTokens = buildTokenSet(bengaliScriptChakmaPhrases)
const romanizedChakmaTokens = new Set([
  ...Array.from(romanizedChakmaDatasetTokens),
  ...Array.from(COMMON_ROMANIZED_CHAKMA_HINTS),
])

function scoreRomanizedChakma(text: string) {
  const inputTokens = uniqueTokens(text)
  const matchedTokens = inputTokens.filter(token => romanizedChakmaTokens.has(token))
  const hintMatches = matchedTokens.filter(token => COMMON_ROMANIZED_CHAKMA_HINTS.has(token))
  const datasetMatches = matchedTokens.filter(token => romanizedChakmaDatasetTokens.has(token))
  const tokenOverlap = inputTokens.length ? matchedTokens.length / inputTokens.length : 0
  const phraseSimilarity = bestPhraseSimilarity(inputTokens, romanizedChakmaPhrases)
  const exactPhraseMatch = romanizedChakmaPhrases.some(phrase => normalizeText(phrase) === normalizeText(text))

  const score = Math.min(
    1,
    (tokenOverlap * 0.45) +
      (phraseSimilarity * 0.45) +
      (hintMatches.length >= 2 ? 0.08 : 0) +
      (exactPhraseMatch ? 0.2 : 0),
  )

  return {
    score,
    tokenOverlap,
    phraseSimilarity,
    exactPhraseMatch,
    matchedTokens,
    hintMatches,
    datasetMatches,
    inputTokenCount: inputTokens.length,
  }
}

function scoreBengaliScriptChakma(text: string) {
  const inputTokens = uniqueTokens(text)
  const matchedTokens = inputTokens.filter(token => bengaliScriptChakmaDatasetTokens.has(token))
  const tokenOverlap = inputTokens.length ? matchedTokens.length / inputTokens.length : 0
  const phraseSimilarity = bestPhraseSimilarity(inputTokens, bengaliScriptChakmaPhrases)
  const exactPhraseMatch = bengaliScriptChakmaPhrases.some(phrase => normalizeText(phrase) === normalizeText(text))
  const score = Math.min(1, (tokenOverlap * 0.5) + (phraseSimilarity * 0.45) + (exactPhraseMatch ? 0.15 : 0))

  return {
    score,
    tokenOverlap,
    phraseSimilarity,
    exactPhraseMatch,
    matchedTokens,
    inputTokenCount: inputTokens.length,
  }
}

export function detectRomanizedChakma(text: string): RomanizedChakmaDetection {
  const trimmed = text.trim()

  if (!trimmed) {
    return {
      language: 'unknown',
      confidence: 0,
      reason: 'No text was provided.',
      matchedTokens: [],
    }
  }

  if (containsNativeChakma(trimmed)) {
    return {
      language: 'native_chakma',
      confidence: 0.99,
      reason: 'Text contains native Chakma Unicode characters in U+11100 to U+1114F.',
      matchedTokens: [],
    }
  }

  if (containsBanglaScript(trimmed)) {
    const bengaliScriptScore = scoreBengaliScriptChakma(trimmed)
    const hasStrongBengaliScriptChakmaMatch =
      bengaliScriptScore.exactPhraseMatch ||
      (
        bengaliScriptScore.inputTokenCount >= 2 &&
        bengaliScriptScore.matchedTokens.length >= 2 &&
        bengaliScriptScore.tokenOverlap >= 0.55 &&
        bengaliScriptScore.phraseSimilarity >= 0.45
      )

    if (hasStrongBengaliScriptChakmaMatch) {
      return {
        language: 'bengali_script_chakma',
        confidence: Number(Math.max(0.78, bengaliScriptScore.score).toFixed(2)),
        reason: `Bengali-script text strongly matches ChakmaBridge examples (token overlap ${bengaliScriptScore.tokenOverlap.toFixed(2)}, phrase similarity ${bengaliScriptScore.phraseSimilarity.toFixed(2)}).`,
        matchedTokens: bengaliScriptScore.matchedTokens,
      }
    }

    return {
      language: 'bangla',
      confidence: 0.72,
      reason: 'Text uses Bangla script but does not strongly match Bengali-script Chakma examples.',
      matchedTokens: bengaliScriptScore.matchedTokens,
    }
  }

  if (LATIN_PATTERN.test(trimmed)) {
    const romanizedScore = scoreRomanizedChakma(trimmed)
    const hasStrongRomanizedChakmaMatch =
      romanizedScore.exactPhraseMatch ||
      (
        romanizedScore.inputTokenCount >= 2 &&
        romanizedScore.matchedTokens.length >= 2 &&
        romanizedScore.hintMatches.length >= 1 &&
        romanizedScore.datasetMatches.length >= 2 &&
        romanizedScore.tokenOverlap >= 0.5 &&
        romanizedScore.phraseSimilarity >= 0.45
      )

    if (hasStrongRomanizedChakmaMatch) {
      return {
        language: 'romanized_chakma',
        confidence: Number(Math.max(0.78, romanizedScore.score).toFixed(2)),
        reason: `Latin text strongly matches Romanized Chakma from ChakmaBridge (token overlap ${romanizedScore.tokenOverlap.toFixed(2)}, phrase similarity ${romanizedScore.phraseSimilarity.toFixed(2)}).`,
        matchedTokens: romanizedScore.matchedTokens,
      }
    }

    return {
      language: 'english',
      confidence: romanizedScore.matchedTokens.length ? 0.62 : 0.76,
      reason: 'Text uses Latin letters but does not have enough ChakmaBridge Romanized Chakma overlap.',
      matchedTokens: romanizedScore.matchedTokens,
    }
  }

  return {
    language: 'unknown',
    confidence: 0.35,
    reason: 'Text does not contain enough recognizable script or dataset evidence.',
    matchedTokens: [],
  }
}

export function runRomanizedChakmaDetectionExamples() {
  return [
    'Mui buji noyarong or',
    'tui hudu thas?',
    'ami bujhte parchi na',
    'What is photosynthesis?',
  ].map(input => ({
    input,
    detection: detectRomanizedChakma(input),
  }))
}
