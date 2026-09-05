export type InputScript = 'bengali' | 'latin' | 'chakma-native' | 'myanmar' | 'mixed' | 'unknown'

export type DetectedInputScript = 'Chakma_Native' | 'Marma_Myanmar_Block' | 'Bengali' | 'Latin' | 'Mixed' | 'Unknown'

export type InputScriptDetection = {
  detected_input_script: DetectedInputScript
  script_counts: Record<string, number>
}

export type OutputScript = Exclude<InputScript, 'mixed'>

export type SupportedAnswerLanguage = 'bangla' | 'bn' | 'english' | 'en' | 'chakma' | 'ccp' | 'ckm' | 'garo' | 'gnk' | 'grt' | 'marma' | 'mrm' | string

type ScriptCounts = {
  bengali: number
  latin: number
  chakma_native: number
  marma_myanmar_block: number
  supported_total: number
}

const DOMINANCE_RATIO = 0.7

function scriptCounts(text: string): ScriptCounts {
  const counts: ScriptCounts = {
    bengali: 0,
    latin: 0,
    chakma_native: 0,
    marma_myanmar_block: 0,
    supported_total: 0,
  }

  for (const char of text.normalize('NFKC')) {
    const codePoint = char.codePointAt(0) || 0

    if (codePoint >= 0x11100 && codePoint <= 0x1114f) {
      counts.chakma_native += 1
      counts.supported_total += 1
    } else if (codePoint >= 0x1000 && codePoint <= 0x109f) {
      counts.marma_myanmar_block += 1
      counts.supported_total += 1
    } else if (codePoint >= 0x0980 && codePoint <= 0x09ff) {
      counts.bengali += 1
      counts.supported_total += 1
    } else if ((codePoint >= 0x0041 && codePoint <= 0x005a) || (codePoint >= 0x0061 && codePoint <= 0x007a)) {
      counts.latin += 1
      counts.supported_total += 1
    }
  }

  return counts
}

function inputScriptFromCounts(counts: ScriptCounts): DetectedInputScript {
  const ranked = [
    ['Chakma_Native', counts.chakma_native],
    ['Marma_Myanmar_Block', counts.marma_myanmar_block],
    ['Bengali', counts.bengali],
    ['Latin', counts.latin],
  ] as const

  const supported = ranked.filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])
  if (!supported.length) return 'Unknown'
  if (supported.length === 1) return supported[0][0]

  const [best, second] = supported
  const bestRatio = counts.supported_total > 0 ? best[1] / counts.supported_total : 0
  if (bestRatio >= DOMINANCE_RATIO && best[1] >= second[1]) return best[0]

  return 'Mixed'
}

export function detectInputScript(text: string): InputScriptDetection {
  const counts = scriptCounts(text)
  return {
    detected_input_script: inputScriptFromCounts(counts),
    script_counts: counts,
  }
}

export function normalizeDetectedInputScript(input: InputScriptDetection | InputScript): InputScript {
  if (typeof input === 'string') return input
  switch (input.detected_input_script) {
    case 'Chakma_Native':
      return 'chakma-native'
    case 'Marma_Myanmar_Block':
      return 'myanmar'
    case 'Bengali':
      return 'bengali'
    case 'Latin':
      return 'latin'
    case 'Mixed':
      return 'mixed'
    default:
      return 'unknown'
  }
}

export function dominantInputScript(text: string): OutputScript {
  const script = normalizeDetectedInputScript(detectInputScript(text))
  return script === 'mixed' || script === 'unknown' ? 'bengali' : script
}

function normalizeSelectedLanguage(selectedLanguage: SupportedAnswerLanguage) {
  return String(selectedLanguage || '').trim().toLowerCase()
}

export function resolveOutputScript(
  selectedLanguage: SupportedAnswerLanguage,
  inputScript: InputScript | InputScriptDetection,
  inputTextForMixedDominance = '',
): OutputScript {
  const language = normalizeSelectedLanguage(selectedLanguage)
  const normalizedInputScript = normalizeDetectedInputScript(inputScript)
  const resolvedInputScript = normalizedInputScript === 'mixed'
    ? dominantInputScript(inputTextForMixedDominance)
    : normalizedInputScript

  if (language === 'bangla' || language === 'bn') return 'bengali'
  if (language === 'english' || language === 'en') return 'latin'

  if (language === 'chakma' || language === 'ccp' || language === 'ckm') {
    if (resolvedInputScript === 'bengali') return 'bengali'
    if (resolvedInputScript === 'latin') return 'latin'
    if (resolvedInputScript === 'chakma-native') return 'chakma-native'
  }

  if (language === 'garo' || language === 'gnk' || language === 'grt') {
    if (resolvedInputScript === 'bengali') return 'bengali'
    if (resolvedInputScript === 'latin') return 'latin'
  }

  if (language === 'marma' || language === 'mrm') {
    if (resolvedInputScript === 'bengali') return 'bengali'
    if (resolvedInputScript === 'latin') return 'latin'
    if (resolvedInputScript === 'myanmar') return 'myanmar'
  }

  return resolvedInputScript === 'unknown' ? 'bengali' : resolvedInputScript
}
