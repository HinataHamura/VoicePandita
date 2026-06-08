import { detectScriptWithConfidence } from './detectScript'
import {
  LANGUAGE_CONFIDENCE_FALLBACK_THRESHOLD,
  type LanguageDetectionInput,
  type LanguageDetectionResult,
  type LearnerLanguage,
  type LearnerScript,
  type SelectedLearnLanguage,
} from './types'

const SELECTED_LANGUAGE_ALIASES: Record<string, SelectedLearnLanguage> = {
  bangla: 'bn',
  bengali: 'bn',
  bn: 'bn',
  ccp: 'chakma',
  chakma: 'chakma',
  garo: 'garo',
  grt: 'garo',
  marma: 'marma',
  mrm: 'marma',
  english: 'en',
  en: 'en',
}

const BANGLA_BENGALI_HINTS = new Set([
  'আমি',
  'আমার',
  'তুমি',
  'তোমার',
  'কী',
  'কি',
  'কেমন',
  'কেন',
  'কোথায়',
  'বাংলা',
])

const BANGLA_LATIN_HINTS = new Set([
  'ami',
  'amar',
  'tumi',
  'tomar',
  'ki',
  'kemon',
  'keno',
  'bangla',
])

const ENGLISH_HINTS = new Set([
  'a',
  'an',
  'and',
  'are',
  'explain',
  'how',
  'is',
  'learn',
  'meaning',
  'of',
  'photosynthesis',
  'the',
  'what',
  'why',
])

const CHAKMA_LATIN_HINTS = new Set([
  'mui',
  'tui',
  'buji',
  'hudu',
  'thas',
  'nang',
  'nangaan',
  'parong',
])

const GARO_LATIN_HINTS = new Set([
  'ang',
  'achik',
  'aro',
  'dak',
  'dong',
  'gita',
  'mande',
  'nang',
  'nangni',
  'rang',
])

const MARMA_LATIN_HINTS = new Set([
  'aong',
  'marma',
  'mraima',
  'rakhine',
  'refungjang',
])

const BENGALI_SCRIPT_LOW_RESOURCE_LANGUAGE: Record<SelectedLearnLanguage, LearnerLanguage | null> = {
  bn: 'bn',
  chakma: 'chakma',
  garo: 'garo',
  marma: 'marma',
  en: null,
}

const LATIN_SCRIPT_SELECTED_LANGUAGE: Record<SelectedLearnLanguage, LearnerLanguage> = {
  bn: 'bn',
  chakma: 'chakma',
  garo: 'garo',
  marma: 'marma',
  en: 'en',
}

function normalizeSelectedLanguage(value: LanguageDetectionInput['selectedLanguage']): SelectedLearnLanguage | null {
  if (!value) return null
  return SELECTED_LANGUAGE_ALIASES[String(value).trim().toLowerCase()] || null
}

function tokenizeBengali(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[^\u0980-\u09FF\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function tokenizeLatin(text: string) {
  return text.normalize('NFKC').toLowerCase().match(/[a-z]+/g) || []
}

function countHits(tokens: string[], hints: Set<string>) {
  return tokens.filter(token => hints.has(token)).length
}

function roundConfidence(confidence: number) {
  return Number(Math.max(0, Math.min(1, confidence)).toFixed(2))
}

function finalizeDetection(
  result: Omit<LanguageDetectionResult, 'confidence' | 'shouldFallback'> & { confidence: number },
): LanguageDetectionResult {
  const confidence = roundConfidence(result.confidence)

  if (confidence < LANGUAGE_CONFIDENCE_FALLBACK_THRESHOLD) {
    return {
      ...result,
      language: 'unknown',
      confidence,
      shouldFallback: true,
      reasons: [...result.reasons, 'low-confidence-fallback'],
    }
  }

  return {
    ...result,
    confidence,
    shouldFallback: false,
  }
}

function nativeScriptDetection(
  script: LearnerScript,
  selectedLanguage: SelectedLearnLanguage | null,
): LanguageDetectionResult | null {
  if (script === 'chakma') {
    return finalizeDetection({
      language: 'chakma',
      script,
      confidence: 0.99,
      selectedLanguage,
      reasons: ['native-chakma-unicode'],
    })
  }

  if (script === 'myanmar') {
    return finalizeDetection({
      language: 'marma',
      script,
      confidence: 0.92,
      selectedLanguage,
      reasons: ['myanmar-unicode-treated-as-marma'],
    })
  }

  return null
}

function detectBengaliScriptLanguage(
  text: string,
  selectedLanguage: SelectedLearnLanguage | null,
): Omit<LanguageDetectionResult, 'shouldFallback'> {
  if (selectedLanguage) {
    const selectedScriptLanguage = BENGALI_SCRIPT_LOW_RESOURCE_LANGUAGE[selectedLanguage]

    if (selectedScriptLanguage) {
      return {
        language: selectedScriptLanguage,
        script: 'bengali',
        confidence: selectedLanguage === 'bn' ? 0.91 : 0.86,
        selectedLanguage,
        reasons: [`selected-${selectedLanguage}-tab`, 'bengali-script'],
      }
    }
  }

  const tokens = tokenizeBengali(text)
  const banglaHits = countHits(tokens, BANGLA_BENGALI_HINTS)

  return {
    language: banglaHits >= 2 ? 'bn' : 'unknown',
    script: 'bengali',
    confidence: banglaHits >= 2 ? 0.72 : 0.58,
    selectedLanguage,
    reasons: banglaHits >= 2 ? [`bangla-bengali-hits:${banglaHits}`] : ['ambiguous-bengali-script'],
  }
}

function scoreLatinWithoutSelectedLanguage(tokens: string[]) {
  const scores: Array<{ language: LearnerLanguage; confidence: number; reason: string }> = [
    { language: 'chakma', confidence: countHits(tokens, CHAKMA_LATIN_HINTS) >= 2 ? 0.72 : 0, reason: 'chakma-latin-hints' },
    { language: 'garo', confidence: countHits(tokens, GARO_LATIN_HINTS) >= 2 ? 0.72 : 0, reason: 'garo-latin-hints' },
    { language: 'marma', confidence: countHits(tokens, MARMA_LATIN_HINTS) >= 1 ? 0.72 : 0, reason: 'marma-latin-hints' },
    { language: 'bn', confidence: countHits(tokens, BANGLA_LATIN_HINTS) >= 2 ? 0.7 : 0, reason: 'romanized-bangla-hints' },
    { language: 'en', confidence: countHits(tokens, ENGLISH_HINTS) >= 2 ? 0.76 : 0, reason: 'english-latin-hints' },
  ]

  return scores.sort((a, b) => b.confidence - a.confidence)[0]
}

function detectLatinScriptLanguage(
  text: string,
  selectedLanguage: SelectedLearnLanguage | null,
): Omit<LanguageDetectionResult, 'shouldFallback'> {
  if (selectedLanguage) {
    return {
      language: LATIN_SCRIPT_SELECTED_LANGUAGE[selectedLanguage],
      script: 'latin',
      confidence: selectedLanguage === 'en' ? 0.78 : 0.82,
      selectedLanguage,
      reasons: [`selected-${selectedLanguage}-tab`, 'latin-script'],
    }
  }

  const best = scoreLatinWithoutSelectedLanguage(tokenizeLatin(text))

  return {
    language: best.language,
    script: 'latin',
    confidence: best.confidence || 0.52,
    selectedLanguage,
    reasons: best.confidence ? [best.reason] : ['ambiguous-latin-script'],
  }
}

export function detectLanguage(input: LanguageDetectionInput | string): LanguageDetectionResult {
  const text = typeof input === 'string' ? input : input.text
  const selectedLanguage = normalizeSelectedLanguage(typeof input === 'string' ? null : input.selectedLanguage)
  const trimmed = text.trim()

  if (!trimmed) {
    return {
      language: 'unknown',
      script: 'unknown',
      confidence: 0,
      shouldFallback: true,
      selectedLanguage,
      reasons: ['empty-input'],
    }
  }

  const scriptDetection = detectScriptWithConfidence(trimmed)
  const nativeDetection = nativeScriptDetection(scriptDetection.script, selectedLanguage)
  if (nativeDetection) return nativeDetection

  if (scriptDetection.script === 'bengali') {
    return finalizeDetection(detectBengaliScriptLanguage(trimmed, selectedLanguage))
  }

  if (scriptDetection.script === 'latin') {
    return finalizeDetection(detectLatinScriptLanguage(trimmed, selectedLanguage))
  }

  return finalizeDetection({
    language: 'unknown',
    script: scriptDetection.script,
    confidence: 0.34,
    selectedLanguage,
    reasons: ['unsupported-or-unrecognized-script'],
  })
}

export { normalizeSelectedLanguage }
