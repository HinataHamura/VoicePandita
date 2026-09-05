/**
 * Manual demo runner (not an assertion suite).
 * Prints what the Chakma + Marma features actually produce, feature by feature.
 *
 *   npx playwright test tests/chakma-marma-demo.spec.ts --reporter=line --workers=1
 *   npx playwright test tests/chakma-marma-demo.spec.ts -g "DEMO 4"   # one feature only
 */
import { test } from '@playwright/test'

import {
  isChakmaText,
  isChakmaLanguage,
  shouldUseChakmaBridge,
  prepareChakmaBridge,
  translateBanglaWithDataset,
  loadChakmaPairs,
  findClosestPair,
} from '../src/lib/chakmaBridge'
import { detectRomanizedChakma, runRomanizedChakmaDetectionExamples } from '../src/lib/chakma/detectRomanizedChakma'
import { loadChakmaBridgeDataset } from '../src/lib/chakmaBridgeDataset'
import { hasMarmaScript, loadMarmaContext, formatMarmaExamples } from '../src/lib/marmaBridge'
import { resolveLanguageRoute } from '../src/lib/multilingual/routingResolver'
import { detectLearnerLanguageAndScript } from '../src/lib/multilingual/detectLanguage'
import { localizeAnswer } from '../src/lib/multilingual/localizeAnswer'
import { detectMultilingualRoute } from '../src/lib/multilingualSupport'

const line = (t: string) => console.log(`\n=== ${t} ===`)
const BENGALI_SCRIPT_DETECTION = {
  script: 'bengali' as const,
  confidence: 1,
  counts: { bengali: 1, latin: 0, chakma: 0, myanmar: 0, unknown: 0 },
}

test('DEMO 1 — Chakma script detection + Bangla to Chakma transliteration', async () => {
  line('1A. isChakmaText / isChakmaLanguage / shouldUseChakmaBridge')
  ;['𑄥𑄨𑄠𑄚𑄴 𑄈𑄬𑄚𑄨𑄇𑄴𑄇𑄬 𑄉𑄧𑄢𑄨 ?', 'তুমি কেমন আছো?', 'How are you?'].forEach(s =>
    console.log(`  "${s}" -> isChakmaText=${isChakmaText(s)}`)
  )
  console.log(`  isChakmaLanguage("ccp")=${isChakmaLanguage('ccp')}  ("bn")=${isChakmaLanguage('bn')}`)
  console.log(`  shouldUseChakmaBridge("সুপ্রভাত","ccp")=${shouldUseChakmaBridge('সুপ্রভাত', 'ccp')}`)

  line('1B. loadChakmaPairs (local committed dataset, no network)')
  const { pairs, source } = await loadChakmaPairs()
  console.log(`  source=${source}  pairs=${pairs.length}`)
  console.log(`  sample: ${pairs[0]?.bn}  ->  ${pairs[0]?.ccp}`)

  line('1C. translateBanglaWithDataset (Bangla answer -> Chakma script)')
  for (const bn of ['ধন্যবাদ ।', 'সুপ্রভাত', 'আলো থেকে গাছ খাদ্য তৈরি করে ।']) {
    console.log(`  ${bn}\n    -> ${translateBanglaWithDataset(bn, pairs)}`)
  }

  line('1D. findClosestPair (fuzzy match)')
  const m = findClosestPair('ধন্যবাদ', 'bn', pairs, 0.4)
  console.log(`  query="ধন্যবাদ" -> score=${m?.score.toFixed(3)} ccp=${m?.pair.ccp}`)
})

test('DEMO 2 — prepareChakmaBridge end-to-end context', async () => {
  line('2A. Chakma-script question')
  const a = await prepareChakmaBridge('𑄥𑄨𑄠𑄚𑄴 𑄈𑄬𑄚𑄨𑄇𑄴𑄇𑄬 𑄉𑄧𑄢𑄨 ?', 'ccp')
  console.log(`  enabled=${a.enabled} detected=${a.detectedLanguage} source=${a.source}`)
  console.log(`  questionForTutor="${a.questionForTutor}"`)
  console.log(`  inputMatch score=${a.inputMatch?.score.toFixed(3) ?? 'none'}  examples=${a.examples.length}`)

  line('2B. Bangla question with ccp requested')
  const b = await prepareChakmaBridge('সুপ্রভাত', 'ccp')
  console.log(`  enabled=${b.enabled} detected=${b.detectedLanguage} examples=${b.examples.length}`)
  console.log(`  first example: ${b.examples[0]?.bn} -> ${b.examples[0]?.ccp}`)

  line('2C. English question, bridge should be OFF')
  const c = await prepareChakmaBridge('What is photosynthesis?', 'en')
  console.log(`  enabled=${c.enabled} source=${c.source}`)
})

test('DEMO 3 — Romanized / Bengali-script Chakma detector', () => {
  line('3A. Built-in example runner')
  runRomanizedChakmaDetectionExamples().forEach(r =>
    console.log(`  "${r.input}"\n    -> ${r.detection.language} (conf ${r.detection.confidence}) tokens=[${r.detection.matchedTokens.join(', ')}]`)
  )

  line('3B. Extra probes')
  const rows = loadChakmaBridgeDataset()
  console.log(`  ChakmaBridge dataset rows = ${rows.length}`)
  const probes = [
    rows[0].romanizedChakma,
    rows[0].bengaliScriptChakma,
    rows[1].romanizedChakma,
    '𑄃𑄟𑄨 𑄡𑄟𑄴 𑄚𑄧 ।',
    'আমি ভাত খাই',
    'Hello world, this is English',
    '',
  ]
  probes.forEach(p => {
    const d = detectRomanizedChakma(p)
    console.log(`  "${p}" -> ${d.language} (${d.confidence})`)
    console.log(`     ${d.reason}`)
  })
})

test('DEMO 4 — Marma bridge', async () => {
  line('4A. hasMarmaScript (Myanmar block U+1000-U+109F)')
  ;['မင်္ဂလာပါ', 'তুমি কেমন আছো?', 'Hello'].forEach(s =>
    console.log(`  "${s}" -> ${hasMarmaScript(s)}`)
  )

  line('4B. loadMarmaContext (local JSONL first, HF fallback)')
  const ctx = await loadMarmaContext(8)
  console.log(`  enabled=${ctx.enabled} source=${ctx.source} examples=${ctx.examples.length}`)
  console.log(formatMarmaExamples(ctx.examples).split('\n').map(l => '  ' + l).join('\n'))
})

test('DEMO 5 — Routing resolver (Chakma & Marma)', () => {
  line('5. resolveLanguageRoute')
  const cases = [
    ['Chakma', 'Bengali'],
    ['Chakma', 'Chakma_Native'],
    ['Chakma', 'Latin'],
    ['Marma', 'Bengali'],
    ['Marma', 'Marma_Myanmar_Block'],
    ['Marma', 'Latin'],
  ] as const

  for (const [lang, script] of cases) {
    const r = resolveLanguageRoute(lang, script)
    console.log(`  ${lang} + ${script}`)
    console.log(`    -> ${r.target_language} / ${r.target_script} | ${r.route_status} | dataset=${r.preferred_dataset}`)
    if (r.fallback_reason) console.log(`    reason: ${r.fallback_reason}`)
  }
})

test('DEMO 6 — Full answer localization pipeline', async () => {
  line('6A. Chakma, Bengali-script, exact bridge hit')
  const d1 = detectLearnerLanguageAndScript({ text: 'তুমি খুব সুন্দর', selectedLanguage: 'ckm' })
  console.log(`  detection: ${JSON.stringify(d1)}`)
  const r1 = await localizeAnswer({
    banglaAnswer: 'তুমি খুব সুন্দর',
    question: 'তুমি খুব সুন্দর',
    languageDetection: d1,
    scriptDetection: BENGALI_SCRIPT_DETECTION,
    selectedLanguage: 'ckm',
  })
  console.log(`  answer="${r1.answerText}"`)
  console.log(`  meta: lang=${r1.metadata.outputLanguage} script=${r1.metadata.outputScript} badge=${r1.metadata.badge} provenance=${r1.metadata.provenance} fallback=${r1.metadata.fallbackUsed}`)

  line('6B. Chakma, no bridge hit, no generator -> safe fallback')
  const d2 = detectLearnerLanguageAndScript({ text: 'সালোকসংশ্লেষণ কীভাবে হয়?', selectedLanguage: 'chakma' })
  const r2 = await localizeAnswer({
    banglaAnswer: 'সালোকসংশ্লেষণে উদ্ভিদ আলো ব্যবহার করে খাদ্য তৈরি করে।',
    question: 'সালোকসংশ্লেষণ কীভাবে হয়?',
    languageDetection: d2,
    scriptDetection: BENGALI_SCRIPT_DETECTION,
    selectedLanguage: 'chakma',
    detectedInputScript: 'bengali',
    resolvedOutputScript: 'bengali',
  })
  console.log(`  answer="${r2.answerText}"`)
  console.log(`  meta: lang=${r2.metadata.outputLanguage} script=${r2.metadata.outputScript} badge=${r2.metadata.badge} provenance=${r2.metadata.provenance} fallback=${r2.metadata.fallbackUsed}`)

  line('6C. Marma selected, Bengali-script question')
  const d3 = detectLearnerLanguageAndScript({ text: 'তুমি কেমন আছো?', selectedLanguage: 'marma' })
  const r3 = await localizeAnswer({
    banglaAnswer: 'আমি ভালো আছি।',
    question: 'তুমি কেমন আছো?',
    languageDetection: d3,
    scriptDetection: BENGALI_SCRIPT_DETECTION,
    selectedLanguage: 'marma',
    detectedInputScript: 'bengali',
    resolvedOutputScript: 'bengali',
  })
  console.log(`  answer="${r3.answerText}"`)
  console.log(`  meta: lang=${r3.metadata.outputLanguage} script=${r3.metadata.outputScript} badge=${r3.metadata.badge} provenance=${r3.metadata.provenance} fallback=${r3.metadata.fallbackUsed}`)

  line('6D. detectMultilingualRoute (this is what /api/ask actually uses)')
  const routeCases = [
    ['𑄃𑄟𑄨 𑄡𑄟𑄴 𑄚𑄧 ।', 'Chakma'],
    ['မင်္ဂလာပါ', 'Marma'],
    ['আমি ভাত খাই', 'Bangla'],
  ] as const

  routeCases.forEach(([text, tab]) => {
    console.log(`  "${text}" (tab=${tab}) -> ${JSON.stringify(detectMultilingualRoute(text, tab))}`)
  })
})
