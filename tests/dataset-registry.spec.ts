import { expect, test } from '@playwright/test'

import {
  canLocalize,
  getAvailableResources,
  getCandidateDatasetSources,
  getDatasetSourceById,
  listDatasetSourceIds,
} from '../src/lib/multilingual/datasetRegistry'

test('registers the expected multilingual source ids', () => {
  expect(listDatasetSourceIds()).toEqual([
    'STANDARD_BANGLA_CURRICULUM',
    'EXCEL_BENGALI_PARALLEL_DATASET',
  ])
})

test('returns Excel Bengali parallel resource for Chakma Bengali script', () => {
  const sources = getCandidateDatasetSources({ target_language: 'chakma', target_script: 'bengali' })

  expect(sources.map(source => source.source_id)).toEqual([
    'EXCEL_BENGALI_PARALLEL_DATASET',
  ])
  expect(sources[0].production_safe).toBe(true)
  expect(sources[0].provenance_note).toContain('Valid only for Bengali-script')
})

test('does not return a resource for Marma script and never treats it as Burmese', () => {
  const sources = getCandidateDatasetSources({ target_language: 'marma', target_script: 'myanmar' })

  expect(sources).toEqual([])
  expect(canLocalize('marma', 'myanmar')).toBe(false)
})

test('returns Excel Bengali parallel resource for Marma Bengali-script output', () => {
  const sources = getCandidateDatasetSources({ target_language: 'marma', target_script: 'bengali' })

  expect(sources.map(source => source.source_id)).toEqual([
    'EXCEL_BENGALI_PARALLEL_DATASET',
  ])
})

test('Garo Latin has no verified local resource', () => {
  const sources = getCandidateDatasetSources({ target_language: 'garo', target_script: 'latin' })

  expect(sources).toEqual([])
  expect(getAvailableResources('garo', 'latin')).toEqual([])
  expect(canLocalize('garo', 'latin')).toBe(false)
})

test('Standard Bangla fallback resource is available only for Bangla Bengali output', () => {
  expect(getDatasetSourceById('STANDARD_BANGLA_CURRICULUM')).toMatchObject({
    is_verified_source: true,
    production_safe: true,
  })
  expect(canLocalize('bn', 'bengali')).toBe(true)
  expect(canLocalize('en', 'latin')).toBe(false)
})
