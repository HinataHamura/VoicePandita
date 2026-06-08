import { formatParallelExamples, selectParallelExamples } from './datasets'
import type { LanguageDetectionResult, LearnerLanguage, LearnerScript, ScriptDetection } from './types'

export type LocalizationMetadata = {
  sourceLanguage: LearnerLanguage
  sourceScript: LearnerScript
  outputLanguage: LearnerLanguage
  outputScript: LearnerScript
  detectionConfidence: number
  translationConfidence: number
  fallbackUsed: boolean
  verified: boolean
}

export type LocalizeAnswerResult = {
  answerText: string
  metadata: LocalizationMetadata
}

export type LocalizeAnswerInput = {
  banglaAnswer: string
  question: string
  languageDetection: LanguageDetectionResult
  scriptDetection: ScriptDetection
  selectedLanguage?: string | null
  subjectContext?: string
  generateText?: (prompt: string) => Promise<string | null>
}

const LOW_RESOURCE_LANGUAGES = new Set<LearnerLanguage>(['chakma', 'garo', 'marma'])

const LANGUAGE_LABELS: Record<LearnerLanguage, string> = {
  bn: 'Standard Bangla',
  chakma: 'Chakma',
  garo: 'Garo',
  marma: 'Marma',
  en: 'English',
  unknown: 'unknown',
}

const SCRIPT_LABELS: Record<LearnerScript, string> = {
  bengali: 'Bengali script',
  latin: 'Latin/Romanized script',
  chakma: 'Chakma Unicode script',
  myanmar: 'Myanmar script',
  unknown: 'unknown script',
}

function fallbackNote(language: LearnerLanguage, script: LearnerScript) {
  const languageLabel = LANGUAGE_LABELS[language] || 'এই ভাষা'
  const scriptLabel = SCRIPT_LABELS[script] || 'এই script'
  return `নোট: ${languageLabel} (${scriptLabel}) localization-এর confidence কম, তাই নিচে Standard Bangla ব্যাখ্যা দেওয়া হলো।`
}

function banglaResult(answerText: string, detection: LanguageDetectionResult): LocalizeAnswerResult {
  return {
    answerText,
    metadata: {
      sourceLanguage: detection.language,
      sourceScript: detection.script,
      outputLanguage: 'bn',
      outputScript: 'bengali',
      detectionConfidence: detection.confidence,
      translationConfidence: 1,
      fallbackUsed: false,
      verified: true,
    },
  }
}

function fallbackResult(answerText: string, detection: LanguageDetectionResult): LocalizeAnswerResult {
  return {
    answerText: `${fallbackNote(detection.language, detection.script)}\n\n${answerText}`,
    metadata: {
      sourceLanguage: detection.language,
      sourceScript: detection.script,
      outputLanguage: 'bn',
      outputScript: 'bengali',
      detectionConfidence: detection.confidence,
      translationConfidence: 0,
      fallbackUsed: true,
      verified: false,
    },
  }
}

function hasScript(text: string, script: LearnerScript) {
  if (script === 'unknown') return true

  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0
    if (script === 'bengali' && codePoint >= 0x0980 && codePoint <= 0x09ff) return true
    if (script === 'latin' && ((codePoint >= 0x0041 && codePoint <= 0x005a) || (codePoint >= 0x0061 && codePoint <= 0x007a))) return true
    if (script === 'chakma' && codePoint >= 0x11100 && codePoint <= 0x1114f) return true
    if (script === 'myanmar' && codePoint >= 0x1000 && codePoint <= 0x109f) return true
  }

  return false
}

function normalizedText(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

function extractAnswerText(raw: string) {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
      if (typeof parsed.answerText === 'string') return parsed.answerText.trim()
      if (typeof parsed.answer === 'string') return parsed.answer.trim()
    } catch {
      return cleaned
    }
  }

  return cleaned
}

function buildPrompt(params: {
  banglaAnswer: string
  question: string
  language: LearnerLanguage
  script: LearnerScript
  subjectContext?: string
}) {
  const examples = selectParallelExamples({
    language: params.language,
    script: params.script,
    limit: 8,
  })
  const hasVerifiedExamples = examples.some(example => example.verified)
  const verifiedInstruction = hasVerifiedExamples
    ? 'Only set verified true if the final wording is directly supported by the verified examples.'
    : 'Set verified false. The provided examples are demo or unavailable and do not verify this translation.'

  return {
    prompt: `You are VoicePandita's Phase 2 answer localizer.
Localize a grounded Standard Bangla tutoring answer into the learner's detected language and script.

Detected learner language: ${LANGUAGE_LABELS[params.language]}
Detected learner script: ${SCRIPT_LABELS[params.script]}
Subject context: ${params.subjectContext || 'Not provided'}

Student question:
${params.question}

Grounded Standard Bangla answer:
${params.banglaAnswer}

Parallel examples:
${formatParallelExamples(examples)}

Rules:
- Keep the answer curriculum-grounded.
- Do not add unsupported facts.
- Use the same language as the learner.
- Use the same script as the learner.
- If input uses English letters for Chakma/Garo/Marma, output must also use English letters.
- If input uses Bengali script for Chakma/Garo/Marma, output must use Bengali script.
- If unsure, return Standard Bangla fallback.
- Never fake verified translation.
- Preserve formulas, symbols, and school science terms when there is no reliable local equivalent.

Return ONLY JSON:
{
  "answerText": "student-facing localized answer or Standard Bangla fallback",
  "fallbackUsed": false,
  "translationConfidence": 0.0,
  "verified": false
}

${verifiedInstruction}`,
    verifiedByDataset: hasVerifiedExamples,
  }
}

export async function localizeAnswer(input: LocalizeAnswerInput): Promise<LocalizeAnswerResult> {
  const detection = input.languageDetection
  const sourceScript = input.scriptDetection.script === 'unknown' ? detection.script : input.scriptDetection.script
  const sourceLanguage = detection.language

  if (detection.shouldFallback || sourceLanguage === 'unknown') {
    return fallbackResult(input.banglaAnswer, {
      ...detection,
      script: sourceScript,
    })
  }

  if (sourceLanguage === 'bn') {
    return banglaResult(input.banglaAnswer, {
      ...detection,
      script: 'bengali',
    })
  }

  if (!LOW_RESOURCE_LANGUAGES.has(sourceLanguage) || sourceScript === 'unknown') {
    return fallbackResult(input.banglaAnswer, {
      ...detection,
      script: sourceScript,
    })
  }

  if (!input.generateText) {
    return fallbackResult(input.banglaAnswer, {
      ...detection,
      script: sourceScript,
    })
  }

  const { prompt, verifiedByDataset } = buildPrompt({
    banglaAnswer: input.banglaAnswer,
    question: input.question,
    language: sourceLanguage,
    script: sourceScript,
    subjectContext: input.subjectContext,
  })

  try {
    const raw = await input.generateText(prompt)
    const answerText = extractAnswerText(raw || '')
    const normalizedAnswer = normalizedText(answerText)

    if (
      !normalizedAnswer ||
      normalizedAnswer === normalizedText(input.banglaAnswer) ||
      normalizedAnswer.includes('Standard Bangla fallback') ||
      !hasScript(normalizedAnswer, sourceScript)
    ) {
      return fallbackResult(input.banglaAnswer, {
        ...detection,
        script: sourceScript,
      })
    }

    return {
      answerText: normalizedAnswer,
      metadata: {
        sourceLanguage,
        sourceScript,
        outputLanguage: sourceLanguage,
        outputScript: sourceScript,
        detectionConfidence: detection.confidence,
        translationConfidence: verifiedByDataset ? 0.74 : 0.62,
        fallbackUsed: false,
        verified: false,
      },
    }
  } catch (err) {
    console.warn('[multilingual] answer localization fallback', err instanceof Error ? err.message : err)
    return fallbackResult(input.banglaAnswer, {
      ...detection,
      script: sourceScript,
    })
  }
}
