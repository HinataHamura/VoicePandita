import { expect, test } from '@playwright/test'

import { resolveLanguageRoute } from '../src/lib/multilingual/routingResolver'

test('falls back for Chakma + Chakma_Native without verified native resource', () => {
  expect(resolveLanguageRoute('Chakma', 'Chakma_Native')).toEqual({
    selected_language: 'Chakma',
    detected_input_script: 'Chakma_Native',
    target_language: 'Bangla',
    target_script: 'Bengali script',
    preferred_dataset: 'STANDARD_BANGLA_CURRICULUM',
    route_status: 'fallback',
    fallback_reason: 'No verified Chakma Unicode resource is registered; fall back to Bangla.',
  })
})

test('routes Chakma + Bengali', () => {
  const result = resolveLanguageRoute('Chakma', 'Bengali')

  expect(result.target_language).toBe('Chakma')
  expect(result.target_script).toBe('Bengali script')
  expect(result.preferred_dataset).toBe('EXCEL_BENGALI_PARALLEL_DATASET')
  expect(result.route_status).toBe('routable')
})

test('falls back for Chakma + Latin without verified Roman resource', () => {
  const result = resolveLanguageRoute('Chakma', 'Latin')

  expect(result).toMatchObject({
    target_language: 'Bangla',
    target_script: 'Bengali script',
    preferred_dataset: 'STANDARD_BANGLA_CURRICULUM',
    route_status: 'fallback',
  })
  expect(result.fallback_reason).toContain('No verified Chakma Latin/Roman resource')
})

test('falls back for Marma + Marma_Myanmar_Block without treating Marma as Burmese', () => {
  expect(resolveLanguageRoute('Marma', 'Marma_Myanmar_Block')).toEqual({
    selected_language: 'Marma',
    detected_input_script: 'Marma_Myanmar_Block',
    target_language: 'Bangla',
    target_script: 'Bengali script',
    preferred_dataset: 'STANDARD_BANGLA_CURRICULUM',
    route_status: 'fallback',
    fallback_reason: 'No verified Marma-script resource is registered; fall back to Bangla. Marma script is a writing system label here, not Burmese/Myanmar language.',
  })
})

test('routes Marma + Bengali', () => {
  const result = resolveLanguageRoute('Marma', 'Bengali')

  expect(result.preferred_dataset).toBe('EXCEL_BENGALI_PARALLEL_DATASET')
  expect(result.target_language).toBe('Marma')
  expect(result.target_script).toBe('Bengali script')
})

test('falls back for Marma + Latin without verified Roman resource', () => {
  const result = resolveLanguageRoute('Marma', 'Latin')

  expect(result).toMatchObject({
    target_language: 'Bangla',
    target_script: 'Bengali script',
    preferred_dataset: 'STANDARD_BANGLA_CURRICULUM',
    route_status: 'fallback',
  })
})

test('routes Garo + Bengali', () => {
  const result = resolveLanguageRoute('Garo', 'Bengali')

  expect(result).toMatchObject({
    target_language: 'Garo',
    target_script: 'Bengali script',
    preferred_dataset: 'EXCEL_BENGALI_PARALLEL_DATASET',
    route_status: 'routable',
  })
})

test('falls back for Garo + Latin without verified Roman resource', () => {
  const result = resolveLanguageRoute('Garo', 'Latin')

  expect(result).toMatchObject({
    target_language: 'Bangla',
    target_script: 'Bengali script',
    preferred_dataset: 'STANDARD_BANGLA_CURRICULUM',
    route_status: 'fallback',
  })
})

test('falls back for Garo + Chakma_Native', () => {
  const result = resolveLanguageRoute('Garo', 'Chakma_Native')

  expect(result.route_status).toBe('fallback')
  expect(result.target_language).toBe('Bangla')
  expect(result.target_script).toBe('Bengali script')
  expect(result.fallback_reason).toContain('Unsupported Garo input script')
})

test('Marma route never outputs Burmese or Myanmar as target_language', () => {
  const result = resolveLanguageRoute('Marma', 'Marma_Myanmar_Block')

  expect(result.target_language).toBe('Bangla')
  expect(result.target_language).not.toBe('Myanmar')
  expect(result.target_language).not.toBe('Burmese')
  expect(result.fallback_reason).toContain('Marma script is a writing system label')
})
