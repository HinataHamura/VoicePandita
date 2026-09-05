import { expect, test } from '@playwright/test'

import { detectLanguage, detectLearnerLanguageAndScript } from '../src/lib/multilingual/detectLanguage'
import { detectScript } from '../src/lib/multilingual/detectScript'
import { fallbackToStandardBangla, localizeAnswer, localizeWithProvenance, repairMojibakeText } from '../src/lib/multilingual/localizeAnswer'
import { detectInputScript, resolveOutputScript } from '../src/lib/language/script'
import { getLanguageExamples } from '../src/lib/languageExamples'

test('detects Bengali script', () => {
  expect(detectScript('আমি বাংলা শিখি')).toBe('bengali')
})

test('detects Latin script', () => {
  expect(detectScript('ami bangla shikhi')).toBe('latin')
})

test('detectInputScript detects Chakma native script', () => {
  const result = detectInputScript('𑄌𑄋𑄴𑄟𑄳𑄦')

  expect(result.detected_input_script).toBe('Chakma_Native')
  expect(result.script_counts.chakma_native).toBeGreaterThan(0)
  expect(result.script_counts.supported_total).toBeGreaterThan(0)
})

test('detectInputScript detects Marma Myanmar-block script', () => {
  const result = detectInputScript('မာရမာ')

  expect(result.detected_input_script).toBe('Marma_Myanmar_Block')
  expect(result.script_counts.marma_myanmar_block).toBeGreaterThan(0)
  expect(result.script_counts.supported_total).toBeGreaterThan(0)
})

test('detectInputScript detects Bengali script', () => {
  const result = detectInputScript('তুমি কেমন আছো?')

  expect(result.detected_input_script).toBe('Bengali')
  expect(result.script_counts.bengali).toBeGreaterThan(0)
  expect(result.script_counts.latin).toBe(0)
})

test('detectInputScript detects Latin script', () => {
  const result = detectInputScript('Tumi kemon aso?')

  expect(result.detected_input_script).toBe('Latin')
  expect(result.script_counts.latin).toBeGreaterThan(0)
  expect(result.script_counts.bengali).toBe(0)
})

test('detects mixed Bengali and Latin script input', () => {
  const result = detectInputScript('আমি photosynthesis শিখি')

  expect(result.detected_input_script).toBe('Mixed')
  expect(result.script_counts.bengali).toBeGreaterThan(0)
  expect(result.script_counts.latin).toBeGreaterThan(0)
})

test('detectInputScript detects Unknown when only unsupported symbols are present', () => {
  const result = detectInputScript('123 !!! 😊')

  expect(result.detected_input_script).toBe('Unknown')
  expect(result.script_counts.supported_total).toBe(0)
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

test('normalizes learn UI ckm code as selected Chakma for Bengali input', () => {
  const result = detectLanguage({ text: 'সালোকসংশ্লেষণ কীভাবে হয়', selectedLanguage: 'ckm' })

  expect(result.script).toBe('bengali')
  expect(result.language).toBe('chakma')
  expect(result.shouldFallback).toBe(false)
})

test('resolves selected Chakma Bengali input to Bengali output script', () => {
  const inputScript = detectInputScript('সালোকসংশ্লেষণ কীভাবে হয়?')

  expect(inputScript.detected_input_script).toBe('Bengali')
  expect(resolveOutputScript('chakma', inputScript, 'সালোকসংশ্লেষণ কীভাবে হয়?')).toBe('bengali')
})

test('resolves selected Chakma Latin input to Latin output script', () => {
  const inputScript = detectInputScript('saloksongshleshon kivabe hoy?')

  expect(inputScript.detected_input_script).toBe('Latin')
  expect(resolveOutputScript('chakma', inputScript, 'saloksongshleshon kivabe hoy?')).toBe('latin')
})

test('selected low-resource mode controls Bengali-script answer language', () => {
  const question = 'সালোকসংশ্লেষণ কীভাবে হয়?'

  for (const selectedLanguage of ['chakma', 'marma', 'garo'] as const) {
    const inputScript = detectInputScript(question)
    const detection = detectLearnerLanguageAndScript({ text: question, selectedLanguage })

    expect(inputScript.detected_input_script).toBe('Bengali')
    expect(resolveOutputScript(selectedLanguage, inputScript, question)).toBe('bengali')
    expect(detection.language).toBe(selectedLanguage)
    expect(detection.script).toBe('bengali')
  }
})

test('ignores TODO placeholder language examples', () => {
  expect(getLanguageExamples('chakma', 'bengali', 3)).toEqual([])
})

test('normalizes learn UI ckm code as selected Chakma for Latin input', () => {
  const result = detectLanguage({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'ckm' })

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
  const result = detectLearnerLanguageAndScript({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'marma' })

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

test('detects Bangla Bengali-script input', () => {
  expect(detectLearnerLanguageAndScript('আমি সালোকসংশ্লেষণ কী জানতে চাই')).toMatchObject({
    language: 'bn',
    script: 'bengali',
    shouldFallback: false,
  })
})

test('uses selected Bangla tab as answer target for English Latin input', () => {
  expect(detectLearnerLanguageAndScript({ text: 'What is photosynthesis and why is it important?', selectedLanguage: 'bn' })).toMatchObject({
    language: 'bn',
    script: 'latin',
    shouldFallback: false,
  })
})

test('repairs mojibake Bangla before showing localized Bangla answer', async () => {
  expect(repairMojibakeText('à¦¸à¦¾à¦²à§‹à¦•à¦¸à¦‚à¦¶à§à¦²à§‡à¦·à¦£')).toBe('সালোকসংশ্লেষণ')

  const detection = detectLearnerLanguageAndScript({
    text: 'Photosynthesis process bujhao',
    selectedLanguage: 'bn',
  })
  const result = await localizeAnswer({
    banglaAnswer: 'à¦¸à¦¾à¦²à§‹à¦•à¦¸à¦‚à¦¶à§à¦²à§‡à¦·à¦£à§‡ à¦‰à¦¦à§à¦­à¦¿à¦¦ à¦†à¦²à§‹ à¦¦à¦¿à§Ÿà§‡ à¦–à¦¾à¦¦à§à¦¯ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§‡à¥¤',
    question: 'Photosynthesis process bujhao',
    languageDetection: detection,
    scriptDetection: { script: 'latin', confidence: 1, counts: { bengali: 0, latin: 1, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'Bangla',
  })

  expect(result.metadata.outputLanguage).toBe('bn')
  expect(result.answerText).toContain('সালোকসংশ্লেষণে')
  expect(result.answerText).not.toContain('à¦')
})

test('preserves selected low-resource language with Bengali script input', () => {
  for (const selectedLanguage of ['chakma', 'garo', 'marma'] as const) {
    expect(detectLearnerLanguageAndScript({ text: 'সালোকসংশ্লেষণ কীভাবে হয়', selectedLanguage })).toMatchObject({
      language: selectedLanguage,
      script: 'bengali',
      shouldFallback: false,
    })
  }
})

test('preserves selected low-resource language with Latin script input', () => {
  for (const selectedLanguage of ['chakma', 'garo', 'marma'] as const) {
    expect(detectLearnerLanguageAndScript({ text: 'photosynthesis ki bhabe hoy', selectedLanguage })).toMatchObject({
      language: selectedLanguage,
      script: 'latin',
      shouldFallback: false,
    })
  }
})

test('returns unknown fallback for mixed unclear input', () => {
  const result = detectLearnerLanguageAndScript('xqz 123 ?!')

  expect(result.language).toBe('unknown')
  expect(result.script).toBe('latin')
  expect(result.shouldFallback).toBe(true)
})

test('returns unknown fallback for empty input', () => {
  expect(detectLearnerLanguageAndScript('')).toMatchObject({
    language: 'unknown',
    script: 'unknown',
    confidence: 0,
    shouldFallback: true,
  })
})

test('localizes exact Chakma Bengali-script bridge match without Bangla fallback', async () => {
  const detection = detectLearnerLanguageAndScript({ text: 'তুমি খুব সুন্দর', selectedLanguage: 'ckm' })
  const result = await localizeAnswer({
    banglaAnswer: 'তুমি খুব সুন্দর',
    question: 'তুমি খুব সুন্দর',
    languageDetection: detection,
    scriptDetection: { script: 'bengali', confidence: 1, counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'ckm',
  })

  expect(result.metadata.outputLanguage).toBe('chakma')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.fallbackUsed).toBe(false)
  expect(result.metadata.provenance).toBe('local-bridge')
  expect(result.answerText).toBe('তুই ভারী দোল')
})

test('Chakma Bengali-script localization may call generator but rejects unusable demo text', async () => {
  let prompt = ''

  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question: 'সালোকসংশ্লেষণ কীভাবে হয়?',
    languageDetection: detectLearnerLanguageAndScript({ text: 'সালোকসংশ্লেষণ কীভাবে হয়?', selectedLanguage: 'chakma' }),
    scriptDetection: { script: 'bengali', confidence: 1, counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'chakma',
    detectedInputScript: 'bengali',
    resolvedOutputScript: 'bengali',
    generateText: async capturedPrompt => {
      prompt = capturedPrompt
      return JSON.stringify({
        answerText: '123',
        fallbackUsed: false,
        translationConfidence: 0,
        verified: false,
      })
    },
  })

  expect(prompt).toContain('Required answer language: Chakma')
  expect(result.metadata.outputLanguage).toBe('chakma')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.metadata.fallbackUsed).toBe(false)
})

test('returns unverified demo for selected Chakma Latin-script input without verified Roman support', async () => {
  const detection = detectLearnerLanguageAndScript({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'ckm' })
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question: 'photosynthesis ki bhabe hoy',
    languageDetection: detection,
    scriptDetection: { script: 'latin', confidence: 1, counts: { bengali: 0, latin: 1, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'ckm',
    generateText: async () => JSON.stringify({
      answerText: 'Bhala prasna. Photosynthesisot gach alo loi khadyo banay.',
      fallbackUsed: false,
      translationConfidence: 0.5,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('chakma')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.fallbackUsed).toBe(false)
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.metadata.verified).toBe(false)
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('Chakma Latin-script localization still rejects wrong-script generator output', async () => {
  let prompt = ''

  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question: 'saloksongshleshon kivabe hoy?',
    languageDetection: detectLearnerLanguageAndScript({ text: 'saloksongshleshon kivabe hoy?', selectedLanguage: 'chakma' }),
    scriptDetection: { script: 'latin', confidence: 1, counts: { bengali: 0, latin: 1, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'chakma',
    detectedInputScript: 'latin',
    resolvedOutputScript: 'latin',
    generateText: async capturedPrompt => {
      prompt = capturedPrompt
      return JSON.stringify({
        answerText: '123',
        fallbackUsed: false,
        translationConfidence: 0,
        verified: false,
      })
    },
  })

  expect(prompt).toContain('Required answer language: Chakma')
  expect(result.metadata.outputLanguage).toBe('chakma')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.badge).toBe('unverified-demo')
})

test('keeps selected Garo route when localizer confidence is unsafe', async () => {
  const detection = detectLearnerLanguageAndScript({ text: 'Photosynthesis process bujhao', selectedLanguage: 'garo' })
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো, পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে গ্লুকোজ তৈরি করে।',
    question: 'Photosynthesis process bujhao',
    languageDetection: detection,
    scriptDetection: { script: 'latin', confidence: 1, counts: { bengali: 0, latin: 1, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'garo',
    detectedInputScript: 'latin',
    resolvedOutputScript: 'latin',
    generateText: async () => JSON.stringify({
      answerText: 'Photosynthesis pa.a re.anga achiknik gipin fake generated answer.',
      fallbackUsed: false,
      translationConfidence: 0,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('garo')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.fallbackUsed).toBe(false)
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.metadata.fallbackReason).toBe('Not enough verified Garo data for confident answer')
  expect(result.metadata.translationConfidence).toBeLessThan(0.45)
  expect(result.answerText).not.toContain('"answerText"')
  expect(result.answerText).not.toContain('"fallbackUsed"')
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('uses JSON-ish Garo localizer output as unverified demo without verified support', async () => {
  const detection = detectLearnerLanguageAndScript({ text: 'Photosynthesis process bujhao', selectedLanguage: 'garo' })
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো, পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে গ্লুকোজ তৈরি করে।',
    question: 'Photosynthesis process bujhao',
    languageDetection: detection,
    scriptDetection: { script: 'latin', confidence: 1, counts: { bengali: 0, latin: 1, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'garo',
    detectedInputScript: 'latin',
    resolvedOutputScript: 'latin',
    generateText: async () => `Here is JSON:
{
  "answerText": "Bebe sing.ani. Photosynthesis-o light aro water use ong.a.",
  "fallbackUsed": false,
  "translationConfidence": 0.52,
  "verified": false
}`,
  })

  expect(result.metadata.outputLanguage).toBe('garo')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.fallbackUsed).toBe(false)
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.answerText).not.toContain('"answerText"')
})

test('Chakma selected plus Bengali script question returns unverified demo when no bridge match exists', async () => {
  const question = 'সালোকসংশ্লেষণ কীভাবে হয়?'
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'chakma' }),
    scriptDetection: { script: 'bengali', confidence: 1, counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'chakma',
    detectedInputScript: 'bengali',
    resolvedOutputScript: 'bengali',
    generateText: async () => JSON.stringify({
      answerText: 'ভালা প্রশ্ন। সালোকসংশ্লেষণত গাছ আলো লই খাদ্য বানায়।',
      fallbackUsed: false,
      translationConfidence: 0.55,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('chakma')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.metadata.verified).toBe(false)
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('Marma selected plus Bengali script question returns unverified demo when no bridge match exists', async () => {
  const question = 'সালোকসংশ্লেষণ কীভাবে হয়?'
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'marma' }),
    scriptDetection: { script: 'bengali', confidence: 1, counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'marma',
    detectedInputScript: 'bengali',
    resolvedOutputScript: 'bengali',
    generateText: async () => JSON.stringify({
      answerText: 'আং আসান করে বলি। সালোকসংশ্লেষণত গাছ আলো লই খাদ্য বানায়।',
      fallbackUsed: false,
      translationConfidence: 0.55,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('marma')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.metadata.verified).toBe(false)
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('Garo selected plus Bengali script question returns unverified demo when no bridge match exists', async () => {
  const question = 'সালোকসংশ্লেষণ কীভাবে হয়?'
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'garo' }),
    scriptDetection: { script: 'bengali', confidence: 1, counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'garo',
    detectedInputScript: 'bengali',
    resolvedOutputScript: 'bengali',
    generateText: async () => JSON.stringify({
      answerText: 'বেবে সিংআনি। ফটোসিন্থেসিসও গাছ আলো আর চি ব্যবহার করে খাদ্য বানায়।',
      fallbackUsed: false,
      translationConfidence: 0.55,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('garo')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.metadata.verified).toBe(false)
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('Chakma selected plus Chakma Unicode question returns unverified demo without verified native-script support', async () => {
  const question = '𑄥𑄨𑄠𑄚𑄴 𑄈𑄬𑄚𑄨𑄇𑄴𑄇𑄬 𑄉𑄧𑄢𑄨 ?'
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'chakma' }),
    scriptDetection: { script: 'chakma', confidence: 1, counts: { bengali: 0, latin: 0, chakma: 1, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'chakma',
    detectedInputScript: 'chakma-native',
    resolvedOutputScript: 'chakma-native',
    generateText: async () => JSON.stringify({
      answerText: '𑄞𑄣𑄧 𑄛𑄳𑄢𑄧𑄥𑄴𑄚𑄧। 𑄥𑄣𑄮𑄇𑄴𑄥𑄧𑄁𑄥𑄴𑄣𑄬𑄥𑄧𑄚𑄬 𑄉𑄌𑄴 𑄃𑄣𑄮 𑄣𑄧𑄠𑄴।',
      fallbackUsed: false,
      translationConfidence: 0.55,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('chakma')
  expect(result.metadata.outputScript).toBe('chakma')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.metadata.verified).toBe(false)
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('Marma selected plus Marma script question returns unverified demo without verified Marma-script support', async () => {
  const question = 'မင်္ဂလာပါ'
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'marma' }),
    scriptDetection: { script: 'myanmar', confidence: 1, counts: { bengali: 0, latin: 0, chakma: 0, myanmar: 1, unknown: 0 } },
    selectedLanguage: 'marma',
    detectedInputScript: 'myanmar',
    resolvedOutputScript: 'myanmar',
    generateText: async () => JSON.stringify({
      answerText: 'မင်္ဂလာပါ။ photosynthesis တွင် အပင်သည် အလင်းကို အသုံးပြုသည်။',
      fallbackUsed: false,
      translationConfidence: 0.55,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('marma')
  expect(result.metadata.outputScript).toBe('myanmar')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('Garo selected plus Latin question returns unverified demo without verified Roman-script support', async () => {
  const question = 'photosynthesis ki bhabe hoy'
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'garo' }),
    scriptDetection: { script: 'latin', confidence: 1, counts: { bengali: 0, latin: 1, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'garo',
    detectedInputScript: 'latin',
    resolvedOutputScript: 'latin',
    generateText: async () => JSON.stringify({
      answerText: 'Bebe sing.ani. Photosynthesis-o sam bolrang lightko jakkale cha.a dakchaka.',
      fallbackUsed: false,
      translationConfidence: 0.55,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('garo')
  expect(result.metadata.outputScript).toBe('latin')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('Bengali script input with Bangla selected returns normal Bangla answer', async () => {
  const question = 'সালোকসংশ্লেষণ কীভাবে হয়?'
  const banglaAnswer = 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।'
  const result = await localizeAnswer({
    banglaAnswer,
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'bn' }),
    scriptDetection: { script: 'bengali', confidence: 1, counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'bn',
  })

  expect(result.metadata.outputLanguage).toBe('bn')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.badge).toBe('verified-dataset')
  expect(result.answerText).toBe(banglaAnswer)
})

test('Bengali script input does not override selected low-resource language', async () => {
  const question = 'সালোকসংশ্লেষণ কীভাবে হয়?'
  const result = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question,
    languageDetection: detectLearnerLanguageAndScript({ text: question, selectedLanguage: 'marma' }),
    scriptDetection: { script: 'bengali', confidence: 1, counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'marma',
    detectedInputScript: 'bengali',
    resolvedOutputScript: 'bengali',
    generateText: async () => JSON.stringify({
      answerText: 'আং আসান করে বলি। এই কথাত আলো লাগে।',
      fallbackUsed: false,
      translationConfidence: 0.55,
      verified: false,
    }),
  })

  expect(result.metadata.outputLanguage).toBe('marma')
  expect(result.metadata.outputScript).toBe('bengali')
  expect(result.metadata.badge).toBe('unverified-demo')
  expect(result.answerText).not.toContain('Standard Bangla')
})

test('localizeWithProvenance and fallbackToStandardBangla expose safe metadata helpers', async () => {
  const detection = detectLearnerLanguageAndScript({ text: 'photosynthesis ki bhabe hoy', selectedLanguage: 'garo' })
  const fallback = fallbackToStandardBangla('সালোকসংশ্লেষণে উদ্ভিদ খাদ্য তৈরি করে।', detection)

  expect(fallback.metadata.badge).toBe('fallback-standard-bangla')
  expect(fallback.metadata.outputLanguage).toBe('bn')

  const localized = await localizeWithProvenance({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ খাদ্য তৈরি করে।',
    question: 'photosynthesis ki bhabe hoy',
    languageDetection: detection,
    scriptDetection: { script: 'latin', confidence: 1, counts: { bengali: 0, latin: 1, chakma: 0, myanmar: 0, unknown: 0 } },
    selectedLanguage: 'garo',
    detectedInputScript: 'latin',
    resolvedOutputScript: 'latin',
  })

  expect(localized.metadata.badge).toBe('unverified-demo')
  expect(localized.metadata.fallbackReason).toBe('Not enough verified Garo data for confident answer')
  expect(localized.metadata.outputLanguage).toBe('garo')
})
