import { expect, test } from '@playwright/test'

import { detectLanguage } from '../src/lib/multilingual/detectLanguage'
import { detectScript } from '../src/lib/multilingual/detectScript'

test('detects Bengali script', () => {
  expect(detectScript('আমি বাংলা শিখি')).toBe('bengali')
})

test('detects Latin script', () => {
  expect(detectScript('ami bangla shikhi')).toBe('latin')
})

test('detects native Chakma Unicode when sample exists', () => {
  const result = detectLanguage('𑄥𑄨𑄠𑄚𑄴 𑄈𑄬𑄚𑄨𑄇𑄴𑄇𑄬 𑄉𑄧𑄢𑄨 ?')

  expect(result.script).toBe('chakma')
  expect(result.language).toBe('chakma')
  expect(result.shouldFallback).toBe(false)
})

test('detects Myanmar Unicode when sample exists', () => {
  const result = detectLanguage('မင်္ဂလာပါ')

  expect(result.script).toBe('myanmar')
  expect(result.language).toBe('marma')
  expect(result.shouldFallback).toBe(false)
})

test('uses selected Chakma tab for Latin input', () => {
  const result = detectLanguage({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'chakma' })

  expect(result.script).toBe('latin')
  expect(result.language).toBe('chakma')
  expect(result.shouldFallback).toBe(false)
})

test('uses selected Garo tab for Latin input', () => {
  const result = detectLanguage({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'garo' })

  expect(result.script).toBe('latin')
  expect(result.language).toBe('garo')
  expect(result.shouldFallback).toBe(false)
})

test('uses selected Marma tab for Latin input', () => {
  const result = detectLanguage({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'marma' })

  expect(result.script).toBe('latin')
  expect(result.language).toBe('marma')
  expect(result.shouldFallback).toBe(false)
})

test('uses selected tabs to disambiguate Bengali script input', () => {
  expect(detectLanguage({ text: 'সালোকসংশ্লেষণ কী', selectedLanguage: 'chakma' })).toMatchObject({
    language: 'chakma',
    script: 'bengali',
    shouldFallback: false,
  })
  expect(detectLanguage({ text: 'সালোকসংশ্লেষণ কী', selectedLanguage: 'garo' })).toMatchObject({
    language: 'garo',
    script: 'bengali',
    shouldFallback: false,
  })
  expect(detectLanguage({ text: 'সালোকসংশ্লেষণ কী', selectedLanguage: 'marma' })).toMatchObject({
    language: 'marma',
    script: 'bengali',
    shouldFallback: false,
  })
  expect(detectLanguage({ text: 'সালোকসংশ্লেষণ কী', selectedLanguage: 'bn' })).toMatchObject({
    language: 'bn',
    script: 'bengali',
    shouldFallback: false,
  })
})

test('returns unknown with fallback for ambiguous Latin input without selected tab', () => {
  const result = detectLanguage('xqz prndl vrm')

  expect(result.script).toBe('latin')
  expect(result.language).toBe('unknown')
  expect(result.confidence).toBeLessThan(0.65)
  expect(result.shouldFallback).toBe(true)
})
