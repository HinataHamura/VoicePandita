import { expect, test } from '@playwright/test'

import { detectLanguage } from '../src/lib/multilingual/detectLanguage'
import { detectScript, detectScriptWithConfidence } from '../src/lib/multilingual/detectScript'
import { localizeAnswer } from '../src/lib/multilingual/localizeAnswer'

async function localizeForTest(params: {
  question: string
  selectedLanguage?: string
  generatedAnswer?: string
}) {
  return localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো, পানি ও কার্বন ডাই-অক্সাইড দিয়ে খাদ্য তৈরি করে।',
    question: params.question,
    languageDetection: detectLanguage({ text: params.question, selectedLanguage: params.selectedLanguage }),
    scriptDetection: detectScriptWithConfidence(params.question),
    selectedLanguage: params.selectedLanguage,
    generateText: params.generatedAnswer
      ? async () => JSON.stringify({
          answerText: params.generatedAnswer,
          fallbackUsed: false,
          translationConfidence: 0.7,
          verified: false,
        })
      : undefined,
  })
}

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

test('Chakma tab and Latin input return Chakma Latin output metadata', async () => {
  const result = await localizeForTest({
    question: 'photosynthesis ki bhabe hoy',
    selectedLanguage: 'chakma',
    generatedAnswer: 'Photosynthesis ot gach alo diye khabar toiri kore.',
  })

  expect(result.metadata.outputLanguage).toBe('chakma')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.fallbackUsed).toBe(false)
})

test('uses selected Garo tab for Latin input', () => {
  const result = detectLanguage({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'garo' })

  expect(result.script).toBe('latin')
  expect(result.language).toBe('garo')
  expect(result.shouldFallback).toBe(false)
})

test('Garo tab and Latin input return Garo Latin output metadata', async () => {
  const result = await localizeForTest({
    question: 'photosynthesis ki bhabe hoy',
    selectedLanguage: 'garo',
    generatedAnswer: 'Photosynthesis o gachrang alo baksa cha-a dakchaka.',
  })

  expect(result.metadata.outputLanguage).toBe('garo')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.fallbackUsed).toBe(false)
})

test('uses selected Marma tab for Latin input', () => {
  const result = detectLanguage({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'marma' })

  expect(result.script).toBe('latin')
  expect(result.language).toBe('marma')
  expect(result.shouldFallback).toBe(false)
})

test('Marma tab and Latin input return Marma Latin output metadata', async () => {
  const result = await localizeForTest({
    question: 'photosynthesis ki bhabe hoy',
    selectedLanguage: 'marma',
    generatedAnswer: 'Photosynthesis re gach alo diye khabar toiri kare.',
  })

  expect(result.metadata.outputLanguage).toBe('marma')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.fallbackUsed).toBe(false)
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

test('Chakma, Garo, and Marma Bengali script cases return Bengali output script metadata', async () => {
  await expect(localizeForTest({
    question: 'সালোকসংশ্লেষণ কী',
    selectedLanguage: 'chakma',
    generatedAnswer: 'সালোকসংশ্লেষণত গাছ আলো দিয়ে খাদ্য তৈরি করে।',
  })).resolves.toMatchObject({
    metadata: { outputLanguage: 'chakma', outputScript: 'bengali', fallbackUsed: false },
  })

  await expect(localizeForTest({
    question: 'সালোকসংশ্লেষণ কী',
    selectedLanguage: 'garo',
    generatedAnswer: 'সালোকসংশ্লেষণত গাছ আলো দিয়ে খাদ্য তৈরি করে।',
  })).resolves.toMatchObject({
    metadata: { outputLanguage: 'garo', outputScript: 'bengali', fallbackUsed: false },
  })

  await expect(localizeForTest({
    question: 'সালোকসংশ্লেষণ কী',
    selectedLanguage: 'marma',
    generatedAnswer: 'সালোকসংশ্লেষণত গাছ আলো দিয়ে খাদ্য তৈরি করে।',
  })).resolves.toMatchObject({
    metadata: { outputLanguage: 'marma', outputScript: 'bengali', fallbackUsed: false },
  })
})

test('returns unknown with fallback for ambiguous Latin input without selected tab', () => {
  const result = detectLanguage('xqz prndl vrm')

  expect(result.script).toBe('latin')
  expect(result.language).toBe('unknown')
  expect(result.confidence).toBeLessThan(0.65)
  expect(result.shouldFallback).toBe(true)
})

test('unknown Latin input without selected tab falls back to Bangla output metadata', async () => {
  const result = await localizeForTest({ question: 'xqz prndl vrm' })

  expect(result.metadata.outputLanguage).toBe('bn')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.fallbackUsed).toBe(true)
  expect(result.answerText).toContain('Standard Bangla')
})

test('existing Bangla flow still returns Bangla Bengali output metadata', async () => {
  const result = await localizeForTest({ question: 'আমি সালোকসংশ্লেষণ কীভাবে হয় বুঝতে চাই', selectedLanguage: 'bn' })

  expect(result.metadata.outputLanguage).toBe('bn')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.fallbackUsed).toBe(false)
})
