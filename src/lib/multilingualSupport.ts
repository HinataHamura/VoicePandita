import chakmaBridgeRows from '@/data/chakma/chakmaBridge.json'

export type DetectedLanguage = 'Bangla' | 'English' | 'Chakma' | 'Marma' | 'Garo' | 'unknown'
export type TargetLanguage = 'Bangla' | 'Chakma' | 'Marma' | 'Garo'
export type DetectedScript = 'Bengali' | 'Latin' | 'Chakma' | 'Myanmar' | 'Unknown'
export type AnswerProvenance = 'verified' | 'generated' | 'fallback'

export type LanguageDetectionDetail =
  | 'Standard Bangla'
  | 'Chakma written in Bengali script'
  | 'Garo written in Bengali script'
  | 'Marma written in Bengali script'
  | 'Chakma native script'
  | 'Garo Romanized'
  | 'Marma native script'
  | 'Marma Romanized'
  | 'Chakma Romanized'
  | 'English'
  | 'Unknown'

export type MultilingualRoute = {
  script: DetectedScript
  language: DetectedLanguage
  detail: LanguageDetectionDetail
  confidence: number
  targetLanguage: TargetLanguage
  outputScript: DetectedScript
  shouldFallbackToBangla: boolean
  selectedTargetLanguage: TargetLanguage
  reasons: string[]
}

export const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  Bangla: 'Bangla',
  Chakma: 'Chakma',
  Marma: 'Marma',
  Garo: 'Garo',
}

const TARGET_ALIASES: Record<string, TargetLanguage> = {
  bn: 'Bangla',
  bangla: 'Bangla',
  bengali: 'Bangla',
  ccp: 'Chakma',
  ckm: 'Chakma',
  chakma: 'Chakma',
  mrm: 'Marma',
  marma: 'Marma',
  myanmar: 'Marma',
  gnk: 'Garo',
  grt: 'Garo',
  garo: 'Garo',
}

const GARO_HINTS = new Set([
  'ang',
  'a',
  'chik',
  'chikgipa',
  'na',
  'na.a',
  'ma.sia',
  'ma',
  'siani',
  'ara',
  'aro',
  'ba',
  'dak',
  'dong',
  'gita',
  'ia',
  'mai',
  'mande',
  'nang',
  'nangni',
  'ona',
  'rang',
  'sani',
  'sal',
  'chi',
])

type ChakmaBridgeRow = {
  bangla?: string
  bengaliScriptChakma?: string
  romanizedChakma?: string
}

const CHAKMA_BRIDGE_ROWS = chakmaBridgeRows as ChakmaBridgeRow[]
const CHAKMA_BENGALI_HINTS = new Set([
  'মুই',
  'তুই',
  'হেজান',
  'আগজ',
  'আগং',
  'হুদু',
  'থাছ',
  'ঘরত',
  'নাঙান',
  'হি',
  'হিয়স',
  'হাঙ',
  'হক্কে',
  'বেক্কুন',
  'যাঙত্তে',
  'ফিরিম',
  'হেবে',
])
const GARO_BENGALI_HINTS = new Set([
  'আং',
  'আচিক',
  'গারো',
  'নাং',
  'নাংনি',
  'মান্দে',
  'রাং',
  'মাসিয়া',
  'চি',
  'সালনি',
  'তেংসু',
  'চাআনিকো',
  'দক',
  'ডং',
])
const MARMA_BENGALI_HINTS = new Set([
  'মারমা',
  'রেফুংজাং',
  'আং',
  'অং',
  'ম্রাইমা',
  'রাখাইন',
])
const MARMA_ROMAN_HINTS = new Set(['refungjang', 'aong', 'mraima', 'marma', 'rakhine'])
const ROMANIZED_BANGLA_HINTS = new Set([
  'ami',
  'amar',
  'tumi',
  'tomar',
  'kemon',
  'kothay',
  'ki',
  'bujhao',
  'bujhi',
  'kore',
  'dao',
])

const CHAKMA_BENGALI_EXAMPLES = CHAKMA_BRIDGE_ROWS
  .map(row => row.bengaliScriptChakma)
  .filter((value): value is string => Boolean(value))

const CHAKMA_ROMAN_HINTS = new Set(
  CHAKMA_BRIDGE_ROWS
    .flatMap(row => String(row.romanizedChakma || '').toLowerCase().match(/[a-z.]+/g) || [])
    .filter(token => token.length >= 3 && !ROMANIZED_BANGLA_HINTS.has(token))
)

export function normalizeTargetLanguage(value: unknown): TargetLanguage {
  const key = String(value || '').trim().toLowerCase()
  return TARGET_ALIASES[key] || 'Bangla'
}

export function targetLanguageToCode(language: TargetLanguage) {
  if (language === 'Bangla') return 'bn'
  if (language === 'Chakma') return 'ccp'
  if (language === 'Marma') return 'mrm'
  return 'gnk'
}

export function detectScript(text: string): DetectedScript {
  const value = text.trim()
  if (!value) return 'Unknown'

  let hasBangla = false
  let hasChakma = false
  let hasMyanmar = false
  let hasLatin = false

  for (const char of value) {
    const codePoint = char.codePointAt(0) || 0
    if (codePoint >= 0x0980 && codePoint <= 0x09ff) hasBangla = true
    if (codePoint >= 0x11100 && codePoint <= 0x1114f) hasChakma = true
    if (codePoint >= 0x1000 && codePoint <= 0x109f) hasMyanmar = true
    if ((codePoint >= 0x0041 && codePoint <= 0x005a) || (codePoint >= 0x0061 && codePoint <= 0x007a)) hasLatin = true
  }

  if (hasChakma) return 'Chakma'
  if (hasMyanmar) return 'Myanmar'
  if (hasBangla) return 'Bengali'
  if (hasLatin) return 'Latin'
  return 'Unknown'
}

function tokenizeBangla(value: string) {
  return value
    .replace(/[^\u0980-\u09FF\s]/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
}

function tokenizeLatin(value: string) {
  return value.toLowerCase().match(/[a-z.]+/g) || []
}

function countHits(tokens: string[], hints: Set<string>) {
  return tokens.filter(token => hints.has(token)).length
}

function chakmaBengaliExampleScore(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return 0

  let best = 0
  for (const example of CHAKMA_BENGALI_EXAMPLES) {
    if (normalized.includes(example) || example.includes(normalized)) {
      best = Math.max(best, normalized.length >= 5 ? 0.86 : 0.72)
      continue
    }

    const queryTokens = new Set(tokenizeBangla(normalized))
    const exampleTokens = new Set(tokenizeBangla(example))
    if (!queryTokens.size || !exampleTokens.size) continue

    let overlap = 0
    queryTokens.forEach(token => {
      if (exampleTokens.has(token)) overlap += 1
    })
    best = Math.max(best, (2 * overlap) / (queryTokens.size + exampleTokens.size))
  }

  return best
}

export function detectMultilingualRoute(
  text: string,
  selectedTargetLanguage: TargetLanguage = 'Bangla'
): MultilingualRoute {
  const value = text.trim()
  const script = detectScript(value)
  const reasons: string[] = []

  if (!value) {
    return {
      script: 'Unknown',
      language: 'unknown',
      detail: 'Unknown',
      confidence: 0,
      targetLanguage: 'Bangla',
      outputScript: 'Bengali',
      shouldFallbackToBangla: true,
      selectedTargetLanguage,
      reasons: ['empty-input'],
    }
  }

  let language: DetectedLanguage = 'unknown'
  let detail: LanguageDetectionDetail = 'Unknown'
  let confidence = 0.35
  let outputScript: DetectedScript = script

  if (script === 'Chakma') {
    language = 'Chakma'
    detail = 'Chakma native script'
    confidence = 0.98
    outputScript = 'Chakma'
    reasons.push('chakma-unicode-block')
  } else if (script === 'Myanmar') {
    language = 'Marma'
    detail = 'Marma native script'
    confidence = 0.9
    outputScript = 'Myanmar'
    reasons.push('myanmar-script-block')
  } else if (script === 'Bengali') {
    const tokens = tokenizeBangla(value)
    const chakmaHits = countHits(tokens, CHAKMA_BENGALI_HINTS)
    const garoHits = countHits(tokens, GARO_BENGALI_HINTS)
    const marmaHits = countHits(tokens, MARMA_BENGALI_HINTS)
    const chakmaExample = chakmaBengaliExampleScore(value)

    const scores: Array<{ language: DetectedLanguage; detail: LanguageDetectionDetail; score: number; reason: string }> = [
      { language: 'Chakma', detail: 'Chakma written in Bengali script', score: Math.max(chakmaExample, chakmaHits >= 2 ? 0.82 : chakmaHits === 1 ? 0.62 : 0), reason: `chakma-bengali-hits:${chakmaHits}` },
      { language: 'Garo', detail: 'Garo written in Bengali script', score: garoHits >= 2 ? 0.8 : garoHits === 1 ? 0.58 : 0, reason: `garo-bengali-hits:${garoHits}` },
      { language: 'Marma', detail: 'Marma written in Bengali script', score: marmaHits >= 2 ? 0.76 : marmaHits === 1 ? 0.55 : 0, reason: `marma-bengali-hits:${marmaHits}` },
    ]
    scores.sort((a, b) => b.score - a.score)

    const best = scores[0]
    if (best.score >= 0.72 || (selectedTargetLanguage !== 'Bangla' && best.language === selectedTargetLanguage && best.score >= 0.58)) {
      language = best.language
      detail = best.detail
      confidence = Math.min(0.9, best.score + (selectedTargetLanguage === best.language ? 0.08 : 0))
      outputScript = 'Bengali'
      reasons.push(best.reason)
    } else {
      language = 'Bangla'
      detail = 'Standard Bangla'
      confidence = 0.82
      outputScript = 'Bengali'
      reasons.push('bengali-script-default-bangla')
    }
  } else if (script === 'Latin') {
    const words = tokenizeLatin(value)
    const garoHits = countHits(words, GARO_HINTS)
    const marmaHits = countHits(words, MARMA_ROMAN_HINTS)
    const chakmaHits = countHits(words, CHAKMA_ROMAN_HINTS)
    const banglaHits = countHits(words, ROMANIZED_BANGLA_HINTS)

    if (selectedTargetLanguage === 'Chakma') {
      language = 'Chakma'
      detail = 'Chakma Romanized'
      confidence = 0.82
      outputScript = 'Latin'
      reasons.push('selected-chakma-tab', 'latin-script')
    } else if (selectedTargetLanguage === 'Garo') {
      language = 'Garo'
      detail = 'Garo Romanized'
      confidence = 0.82
      outputScript = 'Latin'
      reasons.push('selected-garo-tab', 'latin-script')
    } else if (selectedTargetLanguage === 'Marma') {
      language = 'Marma'
      detail = 'Marma Romanized'
      confidence = 0.82
      outputScript = 'Latin'
      reasons.push('selected-marma-tab', 'latin-script')
    } else if (garoHits >= 2) {
      language = 'Garo'
      detail = 'Garo Romanized'
      confidence = Math.min(0.9, 0.62 + garoHits * 0.1)
      outputScript = 'Latin'
      reasons.push(`garo-roman-hits:${garoHits}`)
    } else if (chakmaHits >= 2 && chakmaHits > banglaHits) {
      language = 'Chakma'
      detail = 'Chakma Romanized'
      confidence = Math.min(0.88, 0.62 + chakmaHits * 0.09)
      outputScript = 'Latin'
      reasons.push(`chakma-roman-hits:${chakmaHits}`)
    } else if (marmaHits >= 1) {
      language = 'Marma'
      detail = 'Marma Romanized'
      confidence = Math.min(0.84, 0.62 + marmaHits * 0.1)
      outputScript = 'Latin'
      reasons.push(`marma-roman-hits:${marmaHits}`)
    } else {
      language = 'unknown'
      detail = 'Unknown'
      confidence = 0.52
      outputScript = 'Latin'
      reasons.push('ambiguous-latin-script')
    }
  }

  const targetLanguage: TargetLanguage =
    language === 'Chakma' || language === 'Garo' || language === 'Marma'
      ? language
      : language === 'Bangla'
        ? 'Bangla'
        : selectedTargetLanguage === 'Bangla'
          ? 'Bangla'
          : selectedTargetLanguage

  const lowResource = language === 'Chakma' || language === 'Garo' || language === 'Marma'
  const shouldFallbackToBangla = lowResource ? confidence < 0.68 : language === 'unknown'

  return {
    script,
    language,
    detail,
    confidence: Number(confidence.toFixed(2)),
    targetLanguage,
    outputScript: targetLanguage === 'Bangla' ? 'Bengali' : outputScript,
    shouldFallbackToBangla,
    selectedTargetLanguage,
    reasons,
  }
}

export function detectInputLanguage(text: string): DetectedLanguage {
  return detectMultilingualRoute(text).language
}

export function safeLowResourceFallback(targetLanguage: Exclude<TargetLanguage, 'Bangla'>) {
  return `নোট: ${targetLanguage} ভাষার verified translation data এই প্রশ্নের জন্য এখনও সীমিত, তাই নিচে Standard Bangla ব্যাখ্যা দেওয়া হলো।`
}

export const MULTILINGUAL_SYSTEM_PROMPT = `You are a multilingual educational assistant.
You can understand Bangla, English, Chakma, Garo, and Marma.
Always answer in the selected target language.
When the student clearly asks in Chakma, Garo, or Marma, preserve that language and script preference.
Explain educational topics simply for students.
Do not invent fake Chakma, Garo, or Marma words.
If verified data is not enough, give a safe fallback response.`
