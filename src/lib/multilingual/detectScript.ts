import type { LearnerScript, ScriptDetection } from './types'

const SCRIPT_RANGES: Array<{ script: Exclude<LearnerScript, 'unknown'>; start: number; end: number }> = [
  { script: 'bengali', start: 0x0980, end: 0x09ff },
  { script: 'myanmar', start: 0x1000, end: 0x109f },
  { script: 'chakma', start: 0x11100, end: 0x1114f },
  { script: 'latin', start: 0x0041, end: 0x005a },
  { script: 'latin', start: 0x0061, end: 0x007a },
]

function emptyCounts(): Record<LearnerScript, number> {
  return {
    bengali: 0,
    latin: 0,
    chakma: 0,
    myanmar: 0,
    unknown: 0,
  }
}

function detectCharScript(codePoint: number): LearnerScript {
  const range = SCRIPT_RANGES.find(item => codePoint >= item.start && codePoint <= item.end)
  return range?.script || 'unknown'
}

export function detectScriptWithConfidence(text: string): ScriptDetection {
  const counts = emptyCounts()
  let recognized = 0

  for (const char of text.normalize('NFKC')) {
    if (!char.trim()) continue

    const script = detectCharScript(char.codePointAt(0) || 0)
    counts[script] += 1
    if (script !== 'unknown') recognized += 1
  }

  const candidates: LearnerScript[] = ['chakma', 'myanmar', 'bengali', 'latin']
  const script = candidates.reduce<LearnerScript>(
    (best, candidate) => (counts[candidate] > counts[best] ? candidate : best),
    'unknown',
  )

  if (script === 'unknown' || recognized === 0) {
    return {
      script: 'unknown',
      confidence: 0,
      counts,
    }
  }

  return {
    script,
    confidence: Number((counts[script] / recognized).toFixed(2)),
    counts,
  }
}

export function detectScript(text: string): LearnerScript {
  return detectScriptWithConfidence(text).script
}
