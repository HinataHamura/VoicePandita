export type DetectedLanguage = 'Bangla' | 'English' | 'Chakma' | 'Marma' | 'Garo' | 'unknown'
export type TargetLanguage = 'Bangla' | 'Chakma' | 'Marma' | 'Garo'

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
  'na',
  'ara',
  'aro',
  'ba',
  'dak',
  'gita',
  'ia',
  'mai',
  'mande',
  'nang',
  'ona',
  'rang',
  'sani',
])

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

export function detectInputLanguage(text: string): DetectedLanguage {
  const value = text.trim()
  if (!value) return 'unknown'

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
  if (hasMyanmar) return 'Marma'
  if (hasBangla) return 'Bangla'

  if (hasLatin) {
    const words = value.toLowerCase().match(/[a-z]+/g) || []
    const garoHits = words.filter(word => GARO_HINTS.has(word)).length
    if (garoHits >= 2) return 'Garo'
    return 'English'
  }

  return 'unknown'
}

export function safeLowResourceFallback(targetLanguage: Exclude<TargetLanguage, 'Bangla'>) {
  return `Verified ${targetLanguage} translation data is not available enough for this answer yet. Please add verified ${targetLanguage} educational examples or run the fine-tuned multilingual model before enabling ${targetLanguage} answers.`
}

export const MULTILINGUAL_SYSTEM_PROMPT = `You are a multilingual educational assistant.
You can understand Bangla, English, Chakma, Garo, and Marma.
Always answer in the selected target language.
The selected target language has higher priority than the input language.
Explain educational topics simply for students.
Do not switch language unless the selected target language changes.
Do not invent fake Chakma, Garo, or Marma words.
If verified data is not enough, give a safe fallback response.`
