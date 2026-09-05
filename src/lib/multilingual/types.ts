export type LearnerLanguage = 'bn' | 'chakma' | 'garo' | 'marma' | 'en' | 'unknown'

export type LearnerScript = 'bengali' | 'latin' | 'chakma' | 'myanmar' | 'mixed' | 'unknown'
export type LearnerScriptCounts = Record<Exclude<LearnerScript, 'mixed'>, number> & Partial<Record<'mixed', number>>

export type AnswerProvenance =
  | 'verified-dataset'
  | 'local-bridge'
  | 'unverified-demo'
  | 'fallback-standard-bangla'

export type SelectedLearnLanguage = Exclude<LearnerLanguage, 'unknown'>

export type ScriptDetection = {
  script: LearnerScript
  confidence: number
  counts: LearnerScriptCounts
}

export type LanguageDetectionInput = {
  text: string
  selectedLanguage?: SelectedLearnLanguage | string | null
}

export type LanguageDetectionResult = {
  language: LearnerLanguage
  script: LearnerScript
  confidence: number
  shouldFallback: boolean
  selectedLanguage: SelectedLearnLanguage | null
  reasons: string[]
}

export const LANGUAGE_CONFIDENCE_FALLBACK_THRESHOLD = 0.65
