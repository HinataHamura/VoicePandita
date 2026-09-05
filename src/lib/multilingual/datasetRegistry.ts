import type { LearnerLanguage, LearnerScript } from './types'

export type DatasetSourceId =
  | 'EXCEL_BENGALI_PARALLEL_DATASET'
  | 'STANDARD_BANGLA_CURRICULUM'

export type DatasetSourceLanguage = LearnerLanguage | 'multi'

export type DatasetSourceVerificationLevel =
  | 'native-speaker-reviewed'
  | 'admin-approved'
  | 'dedicated-language-corpus'
  | 'dataset-backed'
  | 'bridge-corpus'
  | 'research-grade'

export type DatasetSourceEntry = {
  source_id: DatasetSourceId
  language: DatasetSourceLanguage
  supported_scripts: Exclude<LearnerScript, 'unknown'>[]
  is_verified_source: boolean
  verification_level: DatasetSourceVerificationLevel
  license_note: string
  production_safe: boolean
  provenance_note: string
}

export type CandidateDatasetSourceQuery = {
  target_language: string
  target_script: string
}

const SOURCE_PRIORITY: DatasetSourceId[] = [
  'STANDARD_BANGLA_CURRICULUM',
  'EXCEL_BENGALI_PARALLEL_DATASET',
]

export const DATASET_SOURCE_REGISTRY: readonly DatasetSourceEntry[] = [
  {
    source_id: 'STANDARD_BANGLA_CURRICULUM',
    language: 'multi',
    supported_scripts: ['bengali'],
    is_verified_source: true,
    verification_level: 'dataset-backed',
    license_note: 'VoicePandita curriculum-grounded Standard Bangla answer path.',
    production_safe: true,
    provenance_note: 'Use for Standard Bangla fallback and Bangla tab output.',
  },
  {
    source_id: 'EXCEL_BENGALI_PARALLEL_DATASET',
    language: 'multi',
    supported_scripts: ['bengali'],
    is_verified_source: true,
    verification_level: 'dataset-backed',
    license_note: 'Current Excel dataset: Bengali-script parallel Chakma, Garo, Marma, Standard Bangla, and English rows.',
    production_safe: true,
    provenance_note: 'Valid only for Bengali-script Chakma/Garo/Marma output. Not valid for Chakma Unicode, Marma script, or Garo Latin output.',
  },
] as const

const DATASET_SOURCE_BY_ID = new Map<DatasetSourceId, DatasetSourceEntry>(
  DATASET_SOURCE_REGISTRY.map(entry => [entry.source_id, entry]),
)

const LANGUAGE_ALIASES: Record<string, LearnerLanguage> = {
  bangla: 'bn',
  bengali: 'bn',
  bn: 'bn',
  ccp: 'chakma',
  ckm: 'chakma',
  chakma: 'chakma',
  en: 'en',
  english: 'en',
  garo: 'garo',
  gnk: 'garo',
  grt: 'garo',
  marma: 'marma',
  mrm: 'marma',
}

const SCRIPT_ALIASES: Record<string, Exclude<LearnerScript, 'unknown'>> = {
  bengali: 'bengali',
  bangla: 'bengali',
  latin: 'latin',
  roman: 'latin',
  romanized: 'latin',
  chakma: 'chakma',
  'chakma-native': 'chakma',
  myanmar: 'myanmar',
}

function normalizeTargetLanguage(value: string): LearnerLanguage {
  return LANGUAGE_ALIASES[String(value || '').trim().toLowerCase()] || 'unknown'
}

function normalizeTargetScript(value: string): LearnerScript {
  return SCRIPT_ALIASES[String(value || '').trim().toLowerCase()] || 'unknown'
}

function matchesSourceTarget(
  source: DatasetSourceEntry,
  targetLanguage: LearnerLanguage,
  targetScript: LearnerScript,
) {
  if (targetLanguage === 'unknown' || targetScript === 'unknown') return false

  switch (source.source_id) {
    case 'STANDARD_BANGLA_CURRICULUM':
      return targetLanguage === 'bn' && targetScript === 'bengali'
    case 'EXCEL_BENGALI_PARALLEL_DATASET':
      return (
        targetScript === 'bengali' &&
        (targetLanguage === 'chakma' || targetLanguage === 'garo' || targetLanguage === 'marma')
      )
    default:
      return false
  }
}

export function getDatasetSourceById(sourceId: DatasetSourceId) {
  return DATASET_SOURCE_BY_ID.get(sourceId) || null
}

export function getCandidateDatasetSources(query: CandidateDatasetSourceQuery) {
  const targetLanguage = normalizeTargetLanguage(query.target_language)
  const targetScript = normalizeTargetScript(query.target_script)

  return DATASET_SOURCE_REGISTRY
    .filter(source => matchesSourceTarget(source, targetLanguage, targetScript))
    .sort((left, right) => SOURCE_PRIORITY.indexOf(left.source_id) - SOURCE_PRIORITY.indexOf(right.source_id))
}

export function getAvailableResources(targetLanguage: string, outputScript: string) {
  return getCandidateDatasetSources({
    target_language: targetLanguage,
    target_script: outputScript,
  })
}

export function canLocalize(targetLanguage: string, outputScript: string) {
  return getAvailableResources(targetLanguage, outputScript).some(
    source => source.is_verified_source && source.production_safe,
  )
}

export function listDatasetSourceIds() {
  return DATASET_SOURCE_REGISTRY.map(entry => entry.source_id)
}
