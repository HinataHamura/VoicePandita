import { formatParallelExamples, selectParallelExamples } from './datasets'
import { canLocalize, getAvailableResources } from './datasetRegistry'
import { findBengaliScriptBridgeMatch } from './localBridge'
import type { AnswerProvenance, LanguageDetectionResult, LearnerLanguage, LearnerScript, ScriptDetection } from './types'
import type { InputScript, OutputScript } from '@/lib/language/script'
import { formatLanguageExamples, getLanguageExamples } from '@/lib/languageExamples'

export type LocalizationMetadata = {
  sourceLanguage: LearnerLanguage
  sourceScript: LearnerScript
  outputLanguage: LearnerLanguage
  outputScript: LearnerScript
  detectionConfidence: number
  translationConfidence: number
  fallbackUsed: boolean
  verified: boolean
  routeSource: 'selected-tab' | 'script-detection' | 'fallback'
  provenance: AnswerProvenance
  badge: AnswerProvenance
  fallbackReason?: string
  bridgeSource?: string
  resourceIds?: string[]
  resourceProvenance?: string[]
}

export type LocalizeAnswerResult = {
  answerText: string
  metadata: LocalizationMetadata
}

type ParsedLocalizerResponse = {
  answerText: string
  fallbackUsed: boolean
  translationConfidence: number | null
  verified: boolean
}

export type LocalizeAnswerInput = {
  banglaAnswer: string
  question: string
  languageDetection: LanguageDetectionResult
  scriptDetection: ScriptDetection
  selectedLanguage?: string | null
  detectedInputScript?: InputScript
  resolvedOutputScript?: OutputScript
  subjectContext?: string
  generateText?: (prompt: string) => Promise<string | null>
}

const LOW_RESOURCE_LANGUAGES = new Set<LearnerLanguage>(['chakma', 'garo', 'marma'])
const SELECTED_LOW_RESOURCE_ALIASES: Partial<Record<string, Exclude<LearnerLanguage, 'bn' | 'en' | 'unknown'>>> = {
  ccp: 'chakma',
  ckm: 'chakma',
  chakma: 'chakma',
  garo: 'garo',
  gnk: 'garo',
  grt: 'garo',
  marma: 'marma',
  mrm: 'marma',
}
const SELECTED_LANGUAGE_ALIASES: Partial<Record<string, Exclude<LearnerLanguage, 'unknown'>>> = {
  bn: 'bn',
  bangla: 'bn',
  bengali: 'bn',
  english: 'en',
  en: 'en',
  ...SELECTED_LOW_RESOURCE_ALIASES,
}

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
  myanmar: 'Marma script',
  mixed: 'mixed script',
  unknown: 'unknown script',
}

const INPUT_SCRIPT_LABELS: Record<InputScript, string> = {
  bengali: 'Bengali letters',
  latin: 'Roman/English letters',
  'chakma-native': 'Chakma native Unicode letters',
  myanmar: 'Marma script letters',
  mixed: 'mixed Bengali and Roman letters',
  unknown: 'unknown writing system',
}

const OUTPUT_SCRIPT_LABELS: Record<OutputScript, string> = {
  bengali: 'Bengali letters',
  latin: 'Roman/English letters',
  'chakma-native': 'Chakma native Unicode letters',
  myanmar: 'Marma script letters',
  unknown: 'unknown writing system',
}

const FALLBACK_REASON_BY_LANGUAGE: Record<Exclude<LearnerLanguage, 'bn' | 'en' | 'unknown'>, string> = {
  chakma: 'Not enough verified Chakma data for confident answer',
  garo: 'Not enough verified Garo data for confident answer',
  marma: 'Not enough verified Marma data for confident answer',
}
const UNVERIFIED_DEMO_DISCLAIMER = 'নোট: এই উত্তরটি verified data থেকে নয়। Native speaker দ্বারা যাচাই করুন।'

const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
}

const MOJIBAKE_TOKEN =
  /(?:[àÃÂâ¥][\u0080-\u00ff\u2013\u2014\u2018-\u201d\u2020-\u2022\u2030-\u203a\u02c6\u02dc\u0152\u0153\u0160\u0161\u0178\u017d\u017e]{1,2})+/g

function cp1252Byte(char: string) {
  const codePoint = char.codePointAt(0) || 0
  return CP1252_TO_BYTE[codePoint] ?? codePoint
}

export function repairMojibakeText(value: string) {
  return value.replace(MOJIBAKE_TOKEN, token => {
    const repaired = Buffer.from(Array.from(token).map(cp1252Byte)).toString('utf8')
    return repaired.includes('\uFFFD') ? token : repaired
  })
}

function outputScriptToLearnerScript(script: OutputScript): LearnerScript {
  if (script === 'bengali') return 'bengali'
  if (script === 'latin') return 'latin'
  if (script === 'chakma-native') return 'chakma'
  if (script === 'myanmar') return 'myanmar'
  return 'unknown'
}

function fallbackReason(language: LearnerLanguage) {
  return LOW_RESOURCE_LANGUAGES.has(language)
    ? FALLBACK_REASON_BY_LANGUAGE[language as Exclude<LearnerLanguage, 'bn' | 'en' | 'unknown'>]
    : 'Input language or script could not be handled confidently'
}

function routeSource(detection: LanguageDetectionResult): LocalizationMetadata['routeSource'] {
  if (detection.selectedLanguage) return 'selected-tab'
  if (!detection.shouldFallback && detection.language !== 'unknown') return 'script-detection'
  return 'fallback'
}

function withUnverifiedDemoDisclaimer(answerText: string) {
  // Safety provenance is carried in metadata to avoid mixing scripts inside the
  // student-facing answer for Latin, Chakma Unicode, or Marma-script routes.
  return answerText
}

function fallbackNote(language: LearnerLanguage, script: LearnerScript) {
  const languageLabel = LANGUAGE_LABELS[language] || 'এই ভাষা'
  const scriptLabel = SCRIPT_LABELS[script] || 'এই script'
  return `নোট: ${languageLabel} (${scriptLabel}) localization-এর confidence কম। ${fallbackReason(language)}, তাই নিচে Standard Bangla ব্যাখ্যা দেওয়া হলো।`
}

function banglaResult(answerText: string, detection: LanguageDetectionResult): LocalizeAnswerResult {
  return {
    answerText: repairMojibakeText(answerText),
    metadata: {
      sourceLanguage: detection.language,
      sourceScript: detection.script,
      outputLanguage: 'bn',
      outputScript: 'bengali',
      detectionConfidence: detection.confidence,
      translationConfidence: 1,
      fallbackUsed: false,
      verified: true,
      routeSource: routeSource(detection),
      provenance: 'verified-dataset',
      badge: 'verified-dataset',
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
      routeSource: routeSource(detection),
      provenance: 'fallback-standard-bangla',
      badge: 'fallback-standard-bangla',
      fallbackReason: fallbackReason(detection.language),
    },
  }
}

export function fallbackToStandardBangla(answerText: string, detection: LanguageDetectionResult): LocalizeAnswerResult {
  return fallbackResult(answerText, detection)
}

function normalizeSelectedAnswerLanguage(value?: string | null) {
  return SELECTED_LANGUAGE_ALIASES[String(value || '').trim().toLowerCase()] || null
}

function bestEffortLowResourceText(language: Exclude<LearnerLanguage, 'bn' | 'en' | 'unknown'>, script: LearnerScript) {
  const examples = selectParallelExamples({ language, script, limit: 1 })
  const opener = examples[0]?.target

  if (language === 'chakma' && script === 'latin') {
    return `${opener || 'Bhala prasna.'} Ei pathot mul kotha sohoj kori koi: dharanata dhape dhape bujho; formula, symbol ar textbook term jekhane dorkar, eki rakho.`
  }

  if (language === 'chakma' && script === 'chakma') {
    return opener || '𑄞𑄣𑄧 𑄛𑄳𑄢𑄧𑄥𑄴𑄚𑄧।'
  }

  if (language === 'chakma') {
    return `${opener || 'ভালা প্রশ্ন।'} এই পাঠত মূল কথা সহজ করি কই: ধারণাটা ধাপে ধাপে বুঝো; সূত্র আর চিহ্ন দরকার হলে একই রাখো।`
  }

  if (language === 'garo' && script === 'latin') {
    return `${opener || 'Bebe sing.ani.'} Ia lessonni miksonganiko altue talatna nanggen: ja∙rik ja∙rik ma∙sie, formula aro symbolrangko apsan donbo.`
  }

  if (language === 'garo') {
    return `${opener || 'বেবে সিংআনি।'} এই পাঠনি মূল কথাকো আলতুয়ে তালাতনা নাংগেন: ধাপে ধাপে মাসিয়ে, সূত্র আর চিহ্ন একই রাখো।`
  }

  if (language === 'marma' && script === 'latin') {
    return `${opener || 'Aong asan kore boli.'} Ei lesson-er mul kotha asan kore bujhai: dhape dhape chinta koro; formula ar symbol eki thakuk.`
  }

  if (language === 'marma' && script === 'myanmar') {
    return opener || 'မင်္ဂလာပါ။'
  }

  return `${opener || 'আং আসান করে বলি।'} এই পাঠের মূল কথা আসান করে বুঝাই: ধাপে ধাপে চিন্তা করো; সূত্র আর চিহ্ন একই থাকুক।`
}

function bestEffortLowResourceResult(params: {
  detection: LanguageDetectionResult
  language: Exclude<LearnerLanguage, 'bn' | 'en' | 'unknown'>
  script: LearnerScript
  confidence: number
}): LocalizeAnswerResult {
  return {
    answerText: withUnverifiedDemoDisclaimer(bestEffortLowResourceText(params.language, params.script)),
    metadata: {
      sourceLanguage: params.language,
      sourceScript: params.script,
      outputLanguage: params.language,
      outputScript: params.script,
      detectionConfidence: params.detection.confidence,
      translationConfidence: params.confidence,
      fallbackUsed: false,
      verified: false,
      routeSource: routeSource(params.detection),
      provenance: 'unverified-demo',
      badge: 'unverified-demo',
      fallbackReason: fallbackReason(params.language),
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

function parseBooleanField(value: unknown) {
  return value === true || String(value).trim().toLowerCase() === 'true'
}

function parseConfidenceField(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(1, value))
  if (typeof value !== 'string') return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null
}

function extractStringFieldFromJsonish(value: string, field: string) {
  const pattern = new RegExp(`["']${field}["']\\s*:\\s*["']([\\s\\S]*?)["']\\s*(?:,|})`)
  const match = value.match(pattern)
  return match?.[1]?.replace(/\\"/g, '"').replace(/\\n/g, '\n').trim() || ''
}

function extractBooleanFieldFromJsonish(value: string, field: string) {
  const pattern = new RegExp(`["']${field}["']\\s*:\\s*(true|false|["']true["']|["']false["'])`, 'i')
  const match = value.match(pattern)
  return match ? parseBooleanField(match[1].replace(/["']/g, '')) : false
}

function extractConfidenceFieldFromJsonish(value: string, field: string) {
  const pattern = new RegExp(`["']${field}["']\\s*:\\s*(\\d+(?:\\.\\d+)?|["']\\d+(?:\\.\\d+)?["'])`)
  const match = value.match(pattern)
  return match ? parseConfidenceField(match[1].replace(/["']/g, '')) : null
}

function parseLocalizerResponse(raw: string): ParsedLocalizerResponse {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start !== -1 && end !== -1 && end > start) {
    const jsonish = cleaned.slice(start, end + 1)

    try {
      const parsed = JSON.parse(jsonish) as Record<string, unknown>
      const answerText = typeof parsed.answerText === 'string'
        ? parsed.answerText.trim()
        : typeof parsed.answer === 'string'
          ? parsed.answer.trim()
          : ''

      return {
        answerText,
        fallbackUsed: parseBooleanField(parsed.fallbackUsed),
        translationConfidence: parseConfidenceField(parsed.translationConfidence),
        verified: parseBooleanField(parsed.verified),
      }
    } catch {
      return {
        answerText: extractStringFieldFromJsonish(jsonish, 'answerText') || extractStringFieldFromJsonish(jsonish, 'answer'),
        fallbackUsed: extractBooleanFieldFromJsonish(jsonish, 'fallbackUsed'),
        translationConfidence: extractConfidenceFieldFromJsonish(jsonish, 'translationConfidence'),
        verified: extractBooleanFieldFromJsonish(jsonish, 'verified'),
      }
    }
  }

  return {
    answerText: cleaned,
    fallbackUsed: false,
    translationConfidence: null,
    verified: false,
  }
}

function buildPrompt(params: {
  banglaAnswer: string
  question: string
  language: LearnerLanguage
  script: LearnerScript
  selectedLanguage?: string | null
  detectedInputScript?: InputScript
  resolvedOutputScript?: OutputScript
  subjectContext?: string
}) {
  const examples = selectParallelExamples({
    language: params.language,
    script: params.script,
    limit: 8,
  })
  const datasetExamples = getLanguageExamples(
    params.language,
    params.resolvedOutputScript || params.script,
    4,
  )
  const hasVerifiedExamples = examples.some(example => example.verified)
  const verifiedInstruction = hasVerifiedExamples
    ? 'Only set verified true if the final wording is directly supported by the verified examples.'
    : 'Set verified false. The provided examples are demo or unavailable and do not verify this translation.'

  return {
    prompt: `You are VoicePandita's Phase 2 answer localizer.
Localize a grounded Standard Bangla tutoring answer into the learner's detected language and script.

User selected language: ${params.selectedLanguage || LANGUAGE_LABELS[params.language]}
Detected input script: ${params.detectedInputScript ? INPUT_SCRIPT_LABELS[params.detectedInputScript] : SCRIPT_LABELS[params.script]}
Required answer language: ${LANGUAGE_LABELS[params.language]}
Required answer script: ${params.resolvedOutputScript ? OUTPUT_SCRIPT_LABELS[params.resolvedOutputScript] : SCRIPT_LABELS[params.script]}

Detected learner language: ${LANGUAGE_LABELS[params.language]}
Detected learner script: ${SCRIPT_LABELS[params.script]}
Subject context: ${params.subjectContext || 'Not provided'}

Student question:
${params.question}

Grounded Standard Bangla answer:
${params.banglaAnswer}

Parallel examples:
${formatParallelExamples(examples)}

Dataset-ready examples:
${formatLanguageExamples(datasetExamples)}

Rules:
- Keep the answer curriculum-grounded.
- Do not add unsupported facts.
- The selected language is the target answer language.
- The output script controls only the writing system, not the answer language.
- You must answer in ${LANGUAGE_LABELS[params.language]} language using ${params.resolvedOutputScript ? OUTPUT_SCRIPT_LABELS[params.resolvedOutputScript] : SCRIPT_LABELS[params.script]}.
- Do not answer in Standard Bangla unless the selected language is Bangla.
- Do not answer in English unless the selected language is English.
- If input uses English letters for Chakma/Garo/Marma, output must also use English letters.
- If input uses Bengali script for Chakma/Garo/Marma, output must use Bengali script.
- If input uses Chakma Unicode for Chakma, output must use Chakma Unicode.
- If input uses Marma script, output must use Marma language in Marma script when verified support exists.
- If confidence is low or the provided examples do not support the wording, return a short safe ${LANGUAGE_LABELS[params.language]} scaffold and preserve school science terms.
- Do not return Standard Bangla or English when the learner selected Chakma, Garo, or Marma.
- Never fake verified translation.
- Preserve formulas, symbols, and school science terms when there is no reliable local equivalent.

Return ONLY JSON:
{
  "answerText": "student-facing localized answer in the requested language and script",
  "fallbackUsed": false,
  "translationConfidence": 0.0,
  "verified": false
}

${verifiedInstruction}`,
    verifiedByDataset: hasVerifiedExamples,
  }
}

function buildEnglishPrompt(params: {
  banglaAnswer: string
  question: string
  subjectContext?: string
}) {
  return `You are VoicePandita's grounded tutoring translator.
Translate the grounded Standard Bangla tutoring answer into clear student-friendly English.

Subject context: ${params.subjectContext || 'Not provided'}

Student question:
${params.question}

Grounded Standard Bangla answer:
${params.banglaAnswer}

Rules:
- Keep the answer curriculum-grounded.
- Do not add unsupported facts.
- Use English in Latin script.
- Preserve formulas and symbols.
- Keep the tone simple and helpful for a school student.

Return ONLY JSON:
{
  "answerText": "student-facing English answer",
  "fallbackUsed": false,
  "translationConfidence": 0.0,
  "verified": false
}`
}

export async function localizeAnswer(input: LocalizeAnswerInput): Promise<LocalizeAnswerResult> {
  const detection = input.languageDetection
  const sourceScript = input.scriptDetection.script === 'unknown' ? detection.script : input.scriptDetection.script
  const requestedOutputScript = input.resolvedOutputScript
    ? outputScriptToLearnerScript(input.resolvedOutputScript)
    : sourceScript
  const selectedAnswerLanguage = normalizeSelectedAnswerLanguage(input.selectedLanguage || detection.selectedLanguage)
  const sourceLanguage = selectedAnswerLanguage || detection.language

  if (!selectedAnswerLanguage && (detection.shouldFallback || sourceLanguage === 'unknown')) {
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

  if (sourceLanguage === 'en' && sourceScript === 'latin') {
    if (!input.generateText) {
      return fallbackResult(input.banglaAnswer, {
        ...detection,
        script: sourceScript,
      })
    }

    try {
      const raw = await input.generateText(buildEnglishPrompt({
        banglaAnswer: input.banglaAnswer,
        question: input.question,
        subjectContext: input.subjectContext,
      }))
      const parsed = parseLocalizerResponse(raw || '')
      const normalizedAnswer = normalizedText(parsed.answerText)

      if (!normalizedAnswer || !hasScript(normalizedAnswer, 'latin')) {
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
          outputLanguage: 'en',
          outputScript: 'latin',
          detectionConfidence: detection.confidence,
          translationConfidence: 0.78,
          fallbackUsed: false,
          verified: false,
          routeSource: routeSource(detection),
          provenance: 'unverified-demo',
          badge: 'unverified-demo',
        },
      }
    } catch (err) {
      console.warn('[multilingual] English answer localization fallback', err instanceof Error ? err.message : err)
      return fallbackResult(input.banglaAnswer, {
        ...detection,
        script: sourceScript,
      })
    }
  }

  if (!LOW_RESOURCE_LANGUAGES.has(sourceLanguage)) {
    return fallbackResult(input.banglaAnswer, {
      ...detection,
      script: sourceScript,
    })
  }

  const lowResourceLanguage = sourceLanguage as Exclude<LearnerLanguage, 'bn' | 'en' | 'unknown'>
  if (requestedOutputScript === 'unknown') {
    return bestEffortLowResourceResult({
      detection,
      language: lowResourceLanguage,
      script: sourceScript === 'unknown' || sourceScript === 'mixed' ? 'bengali' : sourceScript,
      confidence: 0.35,
    })
  }

  const availableResources = getAvailableResources(lowResourceLanguage, requestedOutputScript)
  const resourceIds = availableResources.map(resource => resource.source_id)
  const resourceProvenance = availableResources.map(resource => resource.provenance_note)

  if (!canLocalize(lowResourceLanguage, requestedOutputScript)) {
    if (!input.generateText) {
      return bestEffortLowResourceResult({
        detection,
        language: lowResourceLanguage,
        script: requestedOutputScript,
        confidence: 0.35,
      })
    }
  }

  if (requestedOutputScript === 'bengali') {
    const match = findBengaliScriptBridgeMatch({
      standardBangla: input.banglaAnswer,
      targetLanguage: lowResourceLanguage,
    })

    if (match) {
      return {
        answerText: match.text,
        metadata: {
          sourceLanguage,
          sourceScript,
          outputLanguage: sourceLanguage,
          outputScript: 'bengali',
          detectionConfidence: detection.confidence,
          translationConfidence: match.confidence,
          fallbackUsed: false,
          verified: true,
          routeSource: routeSource(detection),
          provenance: match.provenance,
          badge: match.provenance,
          bridgeSource: match.source,
          resourceIds,
          resourceProvenance,
        },
      }
    }

    if (input.generateText) {
      // Continue below to produce a clearly marked unverified demo answer.
    } else {
      return bestEffortLowResourceResult({
        detection,
        language: lowResourceLanguage,
        script: requestedOutputScript,
        confidence: 0.35,
      })
    }
  }

  if (!input.generateText) {
    return bestEffortLowResourceResult({
      detection,
      language: lowResourceLanguage,
      script: requestedOutputScript,
      confidence: 0.35,
    })
  }

  const { prompt, verifiedByDataset } = buildPrompt({
    banglaAnswer: input.banglaAnswer,
    question: input.question,
    language: lowResourceLanguage,
    script: requestedOutputScript,
    selectedLanguage: input.selectedLanguage,
    detectedInputScript: input.detectedInputScript,
    resolvedOutputScript: input.resolvedOutputScript,
    subjectContext: input.subjectContext,
  })

  try {
    const raw = await input.generateText(prompt)
    const parsed = parseLocalizerResponse(raw || '')
    const normalizedAnswer = normalizedText(parsed.answerText)
    const verified = Boolean(parsed.verified && verifiedByDataset)
    const hasGeneratedDemoText = (parsed.translationConfidence ?? 0) >= 0.45
    const hasTrustedLowResourceText = lowResourceLanguage === 'chakma'
      ? true
      : verified || verifiedByDataset || hasGeneratedDemoText

    if (
      !normalizedAnswer ||
      parsed.fallbackUsed ||
      !hasTrustedLowResourceText ||
      normalizedAnswer === normalizedText(input.banglaAnswer) ||
      normalizedAnswer.includes('Standard Bangla fallback') ||
      !hasScript(normalizedAnswer, requestedOutputScript)
    ) {
      return bestEffortLowResourceResult({
        detection,
        language: lowResourceLanguage,
        script: requestedOutputScript,
        confidence: 0.35,
      })
    }
    const demoConfidence = lowResourceLanguage === 'chakma'
      ? Math.max(0.35, parsed.translationConfidence ?? 0)
      : 0.62

    return {
      answerText: verified ? normalizedAnswer : withUnverifiedDemoDisclaimer(normalizedAnswer),
      metadata: {
        sourceLanguage,
        sourceScript,
        outputLanguage: sourceLanguage,
        outputScript: requestedOutputScript,
        detectionConfidence: detection.confidence,
        translationConfidence: verifiedByDataset ? 0.74 : demoConfidence,
        fallbackUsed: false,
        verified,
        routeSource: routeSource(detection),
        provenance: verified ? 'verified-dataset' : 'unverified-demo',
        badge: verified ? 'verified-dataset' : 'unverified-demo',
      },
    }
  } catch (err) {
    console.warn('[multilingual] answer localization fallback', err instanceof Error ? err.message : err)
    return bestEffortLowResourceResult({
      detection,
      language: lowResourceLanguage,
      script: requestedOutputScript,
      confidence: 0.35,
    })
  }
}

export async function localizeWithProvenance(input: LocalizeAnswerInput): Promise<LocalizeAnswerResult> {
  return localizeAnswer(input)
}
