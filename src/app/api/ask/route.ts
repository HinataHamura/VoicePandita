import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  formatChakmaExamples,
  prepareChakmaBridge,
  selectChakmaExamples,
  translateBanglaWithDataset,
  type ChakmaBridgeContext,
} from '@/lib/chakmaBridge'
import {
  detectInputLanguage,
  normalizeTargetLanguage,
  targetLanguageToCode,
  type TargetLanguage,
} from '@/lib/multilingualSupport'
import { formatMarmaExamples, hasMarmaScript, loadMarmaContext } from '@/lib/marmaBridge'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation'
type EmotionState = 'confident' | 'confused' | 'frustrated'

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 15000)

const LESSONS = {
  newton_second_law: {
    subject: 'physics',
    title: "Newton's Second Law",
    path: ['Physics', 'Force and Motion', "Newton's Laws", 'Second Law', 'Application'],
    keywords: ['newton', 'second law', '2nd law', 'f=ma', 'বল', 'ত্বরণ', 'ভর'],
    facts: [
      'নিউটনের দ্বিতীয় সূত্র: বল = ভর × ত্বরণ, অর্থাৎ F = ma।',
      'একই ভরের বস্তুর উপর বেশি বল দিলে ত্বরণ বেশি হয়। ভর বেশি হলে একই বলেও ত্বরণ কম হয়।',
      'উদাহরণ: খালি ঠেলাগাড়ি সহজে চলে, কিন্তু বোঝাই ঠেলাগাড়ি ঠেলতে বেশি বল লাগে।',
    ],
    diagram: 'graph LR\n  A[বল F] --> B[ভর m]\n  A --> C[ত্বরণ a]\n  B --> D[F = ma]\n  C --> D\n  D --> E[গতি পরিবর্তন]',
  },
  metallic_bond: {
    subject: 'chemistry',
    title: 'Metallic Bond',
    path: ['Chemistry', 'Chemical Bonding', 'Metallic Bond', 'Sea of Electrons'],
    keywords: ['ধাতব', 'metallic', 'metal bond', 'ধাতুর বন্ধন', 'মুক্ত ইলেকট্রন', 'electron sea'],
    facts: [
      'ধাতব বন্ধন হলো ধাতু পরমাণুর ধনাত্মক আয়ন এবং চারপাশে চলাচলকারী মুক্ত ইলেকট্রনের আকর্ষণ।',
      'ধাতুতে বাইরের স্তরের ইলেকট্রনগুলো একটি পরমাণুর সাথে শক্তভাবে বাঁধা থাকে না; তারা অনেক আয়নের চারপাশে ছড়িয়ে থাকে।',
      'এই মুক্ত ইলেকট্রনের জন্য ধাতু বিদ্যুৎ পরিবহন করে, নমনীয় হয় এবং চকচকে দেখায়।',
    ],
    diagram: 'graph LR\n  A[ধাতু পরমাণু] --> B[মুক্ত ইলেকট্রন]\n  A --> C[ধনাত্মক ধাতব আয়ন]\n  B --> D[ইলেকট্রনের সাগর]\n  C --> E[আকর্ষণ]\n  D --> E\n  E --> F[ধাতব বন্ধন]',
  },
  ionic_bond: {
    subject: 'chemistry',
    title: 'Ionic Bond',
    path: ['Chemistry', 'Chemical Bonding', 'Ionic Bond', 'Electron Transfer'],
    keywords: ['আয়নিক', 'ionic', 'ion', 'electron transfer', 'ইলেকট্রন গ্রহণ', 'ইলেকট্রন ছাড়ে'],
    facts: [
      'আয়নিক বন্ধনে এক পরমাণু ইলেকট্রন ছেড়ে দেয়, আর অন্য পরমাণু সেটি গ্রহণ করে।',
      'ইলেকট্রন হারালে ধনাত্মক আয়ন, আর ইলেকট্রন গ্রহণ করলে ঋণাত্মক আয়ন তৈরি হয়।',
      'বিপরীত আধানের আকর্ষণই আয়নিক বন্ধনকে ধরে রাখে।',
    ],
    diagram: 'graph LR\n  A[ধাতু] --> B[ইলেকট্রন ছাড়ে]\n  C[অধাতু] --> D[ইলেকট্রন নেয়]\n  B --> E[ধনাত্মক আয়ন]\n  D --> F[ঋণাত্মক আয়ন]\n  E --> G[আয়নিক বন্ধন]\n  F --> G',
  },
  photosynthesis: {
    subject: 'biology',
    title: 'Photosynthesis',
    path: ['Biology', 'Plant Physiology', 'Photosynthesis', 'Food Production'],
    keywords: ['photosynthesis', 'সালোক', 'উদ্ভিদ', 'chlorophyll', 'co2', 'অক্সিজেন'],
    facts: [
      'সালোকসংশ্লেষণে সবুজ উদ্ভিদ সূর্যের আলো ব্যবহার করে খাদ্য তৈরি করে।',
      'এতে লাগে আলো, পানি, কার্বন ডাই-অক্সাইড এবং ক্লোরোফিল।',
      'ফল হিসেবে গ্লুকোজ তৈরি হয় এবং অক্সিজেন বের হয়।',
    ],
    diagram: 'graph LR\n  A[আলো] --> D[সালোকসংশ্লেষণ]\n  B[CO2] --> D\n  C[পানি] --> D\n  D --> E[গ্লুকোজ]\n  D --> F[অক্সিজেন]',
  },
  quadratic_formula: {
    subject: 'math',
    title: 'Quadratic Formula',
    path: ['Math', 'Algebra', 'Quadratic Equation', 'Formula'],
    keywords: ['quadratic', 'দ্বিঘাত', 'সমীকরণ', 'formula', 'সূত্র', 'x²'],
    facts: [
      'দ্বিঘাত সমীকরণের সাধারণ রূপ ax² + bx + c = 0।',
      'সমাধানের সূত্র: x = (-b ± √(b² - 4ac)) / 2a।',
      'প্রথমে a, b, c আলাদা করো, তারপর সূত্রে বসিয়ে ধাপে ধাপে সমাধান করো।',
    ],
    diagram: 'graph LR\n  A[ax²+bx+c=0] --> B[a,b,c বের করো]\n  B --> C[সূত্রে বসাও]\n  C --> D[x এর মান]\n  D --> E[যাচাই]',
  },
  creative_answer: {
    subject: 'bangla',
    title: 'Creative Answer Structure',
    path: ['Bangla', 'Creative Writing', 'CQ Answer', 'Structure'],
    keywords: ['সৃজনশীল', 'বাংলা', 'উত্তর', 'অনুচ্ছেদ'],
    facts: [
      'সৃজনশীল উত্তরে আগে মূল ভাব, তারপর ব্যাখ্যা, শেষে উদাহরণ লিখতে হয়।',
      'প্রশ্নের নির্দেশক শব্দ যেমন ব্যাখ্যা কর, বিশ্লেষণ কর, মূল্যায়ন কর - এগুলো আগে ধরতে হবে।',
      'পরিষ্কার ভাব, ছোট অনুচ্ছেদ এবং পাঠ্যবইয়ের প্রাসঙ্গিক উদাহরণ নম্বর বাড়ায়।',
    ],
    diagram: 'graph LR\n  A[প্রশ্ন পড়ো] --> B[নির্দেশক শব্দ ধরো]\n  B --> C[মূল ভাব]\n  C --> D[ব্যাখ্যা]\n  D --> E[উদাহরণ]',
  },
} as const

type LessonKey = keyof typeof LESSONS

const defaultBySubject: Record<string, LessonKey> = {
  physics: 'newton_second_law',
  chemistry: 'metallic_bond',
  biology: 'photosynthesis',
  math: 'quadratic_formula',
  bangla: 'creative_answer',
  english: 'creative_answer',
}

function inferLesson(question: string): LessonKey | null {
  const lc = question.toLowerCase()
  return (Object.keys(LESSONS) as LessonKey[]).find(key =>
    LESSONS[key].keywords.some(keyword => lc.includes(keyword.toLowerCase()))
  ) || null
}

function detectEmotion(question: string, previousCount = 0): EmotionState {
  const lc = question.toLowerCase()
  if (previousCount > 1 || ['পারছি না', 'কঠিন', 'হতাশ', 'too hard', 'frustrated'].some(word => lc.includes(word))) return 'frustrated'
  if (['বুঝি না', 'বুঝলাম না', 'কেন', 'কিভাবে', 'বুঝাও', 'bujhi na', 'bujhao', 'why', 'how'].some(word => lc.includes(word))) return 'confused'
  return 'confident'
}

function introFor(emotion: EmotionState) {
  if (emotion === 'frustrated') return 'চিন্তা করো না, খুব ছোট করে ধরি।'
  if (emotion === 'confused') return 'একটা সহজ উদাহরণ দিয়ে শুরু করি।'
  return 'ভালো প্রশ্ন।'
}

function answerFromLesson(lessonKey: LessonKey, mode: OutputMode, emotion: EmotionState, language: string) {
  const lesson = LESSONS[lessonKey]
  const cultural = language !== 'bn' ? 'CHT example ধরলে, jhum farming-এর মতো এখানে ছোট ছোট অংশ মিলে পুরো প্রক্রিয়া তৈরি হয়। ' : ''

  if (mode === 'exam') {
    return `সংজ্ঞা: ${lesson.facts[0]}\n\nব্যাখ্যা: ${lesson.facts[1]}\n\nগুরুত্ব/উদাহরণ: ${lesson.facts[2]}\n\nSocratic check: এই বন্ধন বা ধারণাটি কোন বৈশিষ্ট্য তৈরি করছে?`
  }

  if (mode === 'simple') {
    return `${introFor(emotion)} ${cultural}${lesson.facts[0]} ${lesson.facts[2]} এখন তুমি এক লাইনে বলো, এখানে মূল আকর্ষণ বা কারণটা কী?`
  }

  return `${introFor(emotion)} ${cultural}${lesson.facts.join(' ')} Socratic check: এই concept বুঝতে কোন আগের ধারণাটা জানা দরকার?`
}

async function geminiText(prompt: string) {
  if (!genAI) return null

  const requested = process.env.GEMINI_MODEL?.trim()
  const models = requested
    ? [requested, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']
    : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']

  let lastError: unknown = null
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS, modelName)
      return result.response.text().trim()
    } catch (err) {
      lastError = err
      console.warn(`/api/ask Gemini model failed: ${modelName}`, err instanceof Error ? err.message : err)
    }
  }

  throw lastError
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timer = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })

  return Promise.race([promise, timer]).finally(() => {
    if (timeout) clearTimeout(timeout)
  })
}

async function translateChakmaQuestionWithGemini(question: string, bridge: ChakmaBridgeContext) {
  if (!bridge.enabled || bridge.detectedLanguage !== 'ccp') return bridge.questionForTutor
  if (bridge.inputMatch && bridge.inputMatch.score >= 0.82) return bridge.questionForTutor

  const prompt = `You are translating a student question from Chakma to Bangla for VoicePandita.
Use the parallel Chakma/Bangla examples from the Hugging Face dataset as guidance.

Examples:
${formatChakmaExamples(bridge.examples)}

Chakma student question:
${question}

Return ONLY the Bangla translation. Do not answer the question. Preserve formulas and English scientific terms.`

  try {
    const translated = await geminiText(prompt)
    return translated?.trim() || bridge.questionForTutor
  } catch (err) {
    console.warn('/api/ask Chakma question translation failed', err instanceof Error ? err.message : err)
    return bridge.questionForTutor
  }
}

async function translateBanglaAnswerToChakma(answer: string, bridge: ChakmaBridgeContext) {
  if (!bridge.enabled) return answer

  const datasetFallback = translateBanglaWithDataset(answer, bridge.pairs)
  const answerExamples = selectChakmaExamples(answer, bridge.pairs, 16)

  if (!genAI) return datasetFallback

  const prompt = `Translate this Bangla tutoring answer into Chakma language using Chakma script (ISO 639-3: ccp).
Use the parallel examples from the Hugging Face dataset as style and vocabulary guidance.

Examples:
${formatChakmaExamples(answerExamples)}

Bangla answer:
${answer}

Rules:
- Return ONLY the Chakma translation.
- Preserve formulas, symbols, English science terms, and Mermaid-independent wording.
- Keep the Socratic follow-up question as a question in Chakma.
- If a school term has no reliable Chakma equivalent, keep that term in Bangla/English inside the Chakma sentence.`

  try {
    const translated = await geminiText(prompt)
    return translateBanglaWithDataset(translated?.trim() || datasetFallback, bridge.pairs)
  } catch (err) {
    console.warn('/api/ask Chakma answer translation failed', err instanceof Error ? err.message : err)
    return datasetFallback
  }
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Gemini did not return JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

function safeDiagram(value: unknown, fallbackTitle: string) {
  if (typeof value === 'string' && /^(graph|flowchart)\s+/i.test(value.trim())) return value.trim()
  return `graph LR\n  A[প্রশ্ন] --> B[${fallbackTitle || 'Concept'}]\n  B --> C[কারণ]\n  C --> D[ফলাফল]\n  D --> E[বোঝা]`
}

const BANGLA_TO_MARMA_SCRIPT: Record<string, string> = {
  অ: 'အ',
  আ: 'အာ',
  ই: 'ဣ',
  ঈ: 'ဤ',
  উ: 'ဥ',
  ঊ: 'ဦ',
  ঋ: 'ရီ',
  এ: 'အေ',
  ঐ: 'အိုက်',
  ও: 'အို',
  ঔ: 'အောက်',
  ক: 'က',
  খ: 'ခ',
  গ: 'ဂ',
  ঘ: 'ဃ',
  ঙ: 'င',
  চ: 'စ',
  ছ: 'ဆ',
  জ: 'ဇ',
  ঝ: 'ဈ',
  ঞ: 'ည',
  ট: 'တ',
  ঠ: 'ထ',
  ড: 'ဒ',
  ঢ: 'ဓ',
  ণ: 'န',
  ত: 'တ',
  থ: 'သ',
  দ: 'ဒ',
  ধ: 'ဓ',
  ন: 'န',
  প: 'ပ',
  ফ: 'ဖ',
  ব: 'ဗ',
  ভ: 'ဘ',
  ম: 'မ',
  য: 'ယ',
  র: 'ရ',
  ল: 'လ',
  শ: 'ရှ',
  ষ: 'ရှ',
  স: 'စ',
  হ: 'ဟ',
  ড়: 'ရ',
  ঢ়: 'ရ',
  য়: 'ယ',
  '়': '',
  'ং': 'ံ',
  'ঃ': 'း',
  'ঁ': 'ံ',
  'া': 'ာ',
  'ি': 'ိ',
  'ী': 'ီ',
  'ু': 'ု',
  'ূ': 'ူ',
  'ৃ': 'ြိ',
  'ে': 'ေ',
  'ৈ': 'ိုင်',
  'ো': 'ို',
  'ৌ': 'ေါ',
  '্': '်',
  '০': '၀',
  '১': '၁',
  '২': '၂',
  '৩': '၃',
  '৪': '၄',
  '৫': '၅',
  '৬': '၆',
  '৭': '၇',
  '৮': '၈',
  '৯': '၉',
  '।': '။',
}

const BANGLA_TO_LATIN_SCRIPT: Record<string, string> = {
  অ: 'a',
  আ: 'a',
  ই: 'i',
  ঈ: 'i',
  উ: 'u',
  ঊ: 'u',
  ঋ: 'ri',
  এ: 'e',
  ঐ: 'oi',
  ও: 'o',
  ঔ: 'ou',
  ক: 'k',
  খ: 'kh',
  গ: 'g',
  ঘ: 'gh',
  ঙ: 'ng',
  চ: 'ch',
  ছ: 'chh',
  জ: 'j',
  ঝ: 'jh',
  ঞ: 'ny',
  ট: 't',
  ঠ: 'th',
  ড: 'd',
  ঢ: 'dh',
  ণ: 'n',
  ত: 't',
  থ: 'th',
  দ: 'd',
  ধ: 'dh',
  ন: 'n',
  প: 'p',
  ফ: 'ph',
  ব: 'b',
  ভ: 'bh',
  ম: 'm',
  য: 'y',
  র: 'r',
  ল: 'l',
  শ: 'sh',
  ষ: 'sh',
  স: 's',
  হ: 'h',
  ড়: 'r',
  ঢ়: 'rh',
  য়: 'y',
  '়': '',
  'ং': 'ng',
  'ঃ': 'h',
  'ঁ': 'n',
  'া': 'a',
  'ি': 'i',
  'ী': 'i',
  'ু': 'u',
  'ূ': 'u',
  'ৃ': 'ri',
  'ে': 'e',
  'ৈ': 'oi',
  'ো': 'o',
  'ৌ': 'ou',
  '্': '',
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
  '।': '.',
}

const GARO_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/সালোকসংশ্লেষণ/g, 'photosynthesis'],
  [/উদ্ভিদ/g, 'sam bolrang'],
  [/আলো/g, 'salni teng.su'],
  [/পানি/g, 'chi'],
  [/অক্সিজেন/g, 'oxygen'],
  [/গ্লুকোজ/g, 'glucose'],
  [/খাদ্য/g, 'cha.aniko'],
  [/কার্বন ডাই-অক্সাইড|CO2/g, 'CO2'],
  [/ক্লোরোফিল/g, 'chlorophyll'],
  [/বল/g, 'bil'],
  [/ভর/g, 'jrimani'],
  [/ত্বরণ/g, 'ta.rake re.ani'],
  [/গতি/g, 're.ani'],
  [/ধাতু/g, 'metal'],
  [/অধাতু/g, 'non-metal'],
  [/ইলেকট্রন/g, 'electron'],
  [/আয়ন/g, 'ion'],
  [/বন্ধন/g, 'bond'],
  [/আকর্ষণ/g, 'salnapani'],
  [/প্রশ্ন/g, 'sing.aniko'],
  [/কারণ/g, 'a.sel'],
  [/ফলাফল/g, 'bite'],
  [/বোঝা/g, 'ma.siani'],
  [/সূত্র/g, 'formula'],
  [/যাচাই/g, 'nirokani'],
  [/উদাহরণ/g, 'mesokani'],
  [/ব্যাখ্যা/g, 'talatani'],
  [/মূল ভাব/g, 'mongsonggipa miksongani'],
]

function transliterateBangla(value: string, alphabet: Record<string, string>) {
  let output = ''
  for (const char of value) {
    const codePoint = char.codePointAt(0) || 0
    output += codePoint >= 0x0980 && codePoint <= 0x09ff ? alphabet[char] ?? char : char
  }
  return output
}

function translateBanglaToGaroText(value: string) {
  let output = value
  for (const [pattern, replacement] of GARO_TERM_REPLACEMENTS) {
    output = output.replace(pattern, replacement)
  }
  return transliterateBangla(output, BANGLA_TO_LATIN_SCRIPT)
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.!,])/g, '$1')
    .trim()
}

function translateBanglaToMarmaScript(value: string) {
  return transliterateBangla(value, BANGLA_TO_MARMA_SCRIPT)
}

function sanitizeMermaidLabel(label: string) {
  return label.replace(/[[\]{}<>]/g, '').replace(/\s+/g, ' ').trim() || 'Concept'
}

function translateMermaidLabels(chart: string, translator: (label: string) => string) {
  return chart.replace(/\[([^\]]+)\]/g, (_, label: string) => `[${sanitizeMermaidLabel(translator(label))}]`)
}

function localizeDiagram(
  chart: string | null,
  targetLanguage: TargetLanguage,
  bridge: ChakmaBridgeContext
) {
  if (!chart) return null
  if (targetLanguage === 'Bangla') return chart
  if (targetLanguage === 'Chakma') {
    return translateMermaidLabels(chart, label => translateBanglaWithDataset(label, bridge.pairs))
  }
  if (targetLanguage === 'Marma') {
    return translateMermaidLabels(chart, translateBanglaToMarmaScript)
  }
  return translateMermaidLabels(chart, translateBanglaToGaroText)
}

async function dynamicGeminiNode(params: {
  question: string
  selectedSubject: string
  outputMode: OutputMode
  emotion: EmotionState
  inputLanguage: string
  targetLanguage: TargetLanguage
  conceptMemory: unknown
}) {
  const memoryText = Array.isArray(params.conceptMemory)
    ? params.conceptMemory
        .slice(0, 6)
        .map((item: any) => Array.isArray(item.graphPath) ? item.graphPath.join(' -> ') : '')
        .filter(Boolean)
        .join('\n')
    : ''

  const prompt = `You are VoicePandita's dynamic GraphRAG planner for SSC/HSC/admission students in Bangladesh.
The question may be new and not in the local graph. Create a fresh curriculum-safe concept node.

Student question: ${params.question}
Selected subject from UI: ${params.selectedSubject}
Emotion: ${params.emotion}
Detected input language: ${params.inputLanguage}
Selected target language: ${params.targetLanguage}
Output mode: ${params.outputMode}
Recent student concept memory:
${memoryText || 'None'}

Return ONLY valid JSON with this shape:
{
  "subject": "Physics/Chemistry/Biology/Math/Bangla/English",
  "conceptTitle": "short concept title",
  "graphPath": ["Subject", "Chapter", "Topic", "Subtopic"],
  "answer": "Bangla source answer, max 130 words, exact to the question, no unrelated concept",
  "diagram": "valid Mermaid graph LR diagram with 4-6 nodes using Bangla labels"
}

Rules:
- Infer the true school subject from the question first; the selected subject may be wrong.
- Create the answer in Bangla first. A separate language router will convert it or safely fall back.
- Must answer the exact question.
- If the student asks repeated words like 'করো করো করো', ignore repetition.
- If emotion is confused, use a simple analogy.
- If emotion is frustrated, be short and encouraging.
- End answer with one Socratic follow-up question.
- Do not invent fake textbook references.`

  const raw = await geminiText(prompt)
  if (!raw) throw new Error('Gemini unavailable')
  const parsed = extractJson(raw)
  const graphPath = Array.isArray(parsed.graphPath) && parsed.graphPath.length >= 2
    ? parsed.graphPath.map((part: unknown) => String(part)).slice(0, 6)
    : [String(parsed.subject || params.selectedSubject || 'Curriculum'), String(parsed.conceptTitle || 'Concept')]

  return {
    answer: String(parsed.answer || '').trim(),
    diagram: safeDiagram(parsed.diagram, String(parsed.conceptTitle || 'Concept')),
    graphPath,
    subject: String(parsed.subject || params.selectedSubject || 'Curriculum'),
  }
}

async function maybeGenerateLowResourceAnswer(params: {
  banglaAnswer: string
  originalQuestion: string
  inputLanguage: string
  targetLanguage: Exclude<TargetLanguage, 'Bangla' | 'Chakma'>
  subjectContext: string
}) {
  const deterministicFallback = params.targetLanguage === 'Garo'
    ? translateBanglaToGaroText(params.banglaAnswer)
    : translateBanglaToMarmaScript(params.banglaAnswer)

  const prompt = `You are VoicePandita's multilingual tutoring translator.
Translate the Bangla source answer into the selected target language for a school student.

Selected target language: ${params.targetLanguage}
Detected input language: ${params.inputLanguage}
Subject context: ${params.subjectContext || 'Not provided'}

Student question:
${params.originalQuestion}

Bangla source answer:
${params.banglaAnswer}

Return only the student-facing answer in ${params.targetLanguage}.
For Garo, write in the Latin-script A.chik/Garo style used by students.
For Marma, write in Myanmar script.
Keep formulas, symbols, and school science terms if there is no reliable local equivalent.
Do not return an English availability warning.`

  try {
    const generated = await geminiText(prompt)
    return generated?.trim() || deterministicFallback
  } catch (err) {
    console.warn(`/api/ask ${params.targetLanguage} answer generation failed`, err instanceof Error ? err.message : err)
    return deterministicFallback
  }
}

async function translateBanglaAnswerToMarma(params: {
  banglaAnswer: string
  originalQuestion: string
  inputLanguage: string
  subjectContext: string
}) {
  const deterministicFallback = translateBanglaToMarmaScript(params.banglaAnswer)
  if (!genAI) return deterministicFallback

  const marma = await loadMarmaContext()
  if (!marma.enabled) return deterministicFallback

  const prompt = `You are VoicePandita's multilingual tutoring translator.
You are writing for Marma-speaking students in Bangladesh.
Use Marma language written in Myanmar script.
The examples below are real Marma text from CLEAR-Global/marmaspeak-text. Use them only as script/style evidence, not as answer content.

Marma corpus examples:
${formatMarmaExamples(marma.examples)}

Detected input language: ${params.inputLanguage}
Selected target language: Marma
Subject context: ${params.subjectContext || 'Not provided'}

Student question:
${params.originalQuestion}

Bangla educational source answer:
${params.banglaAnswer}

Rules:
- Return only the student-facing answer in Marma language using Myanmar script.
- Keep formulas, symbols, and science terms like CO2, glucose, photosynthesis, F = ma if there is no reliable Marma equivalent.
- Keep it simple for a school student.
- Do not output Bangla or English paragraphs.
- Do not return an English availability warning.`

  try {
    const generated = await geminiText(prompt)
    const answer = generated?.trim() || ''
    if (!answer) return deterministicFallback
    if (!hasMarmaScript(answer)) return deterministicFallback
    return answer
  } catch (err) {
    console.warn('/api/ask Marma answer generation failed', err instanceof Error ? err.message : err)
    return deterministicFallback
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const originalQuestion = String(body.question || '').trim()
    if (!originalQuestion) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const outputMode = String(body.outputMode || 'whiteboard') as OutputMode
    const targetLanguage = normalizeTargetLanguage(body.selected_target_language || body.target_language || body.language || 'Bangla')
    const language = targetLanguageToCode(targetLanguage)
    const inputLanguage = detectInputLanguage(originalQuestion)
    const repeatCount = Number(body.repeatCount || 0)
    const selectedSubject = String(body.subject || 'physics')
    const bridge = await prepareChakmaBridge(originalQuestion, language)
    const question = await translateChakmaQuestionWithGemini(originalQuestion, bridge)
    const lessonKey = inferLesson(question)
    const detectedEmotion = detectEmotion(question, repeatCount)
    const emotion = (body.emotion || detectedEmotion) as EmotionState
    const conceptMemory = body.conceptMemory

    let lesson = lessonKey ? LESSONS[lessonKey] : LESSONS[defaultBySubject[selectedSubject] || 'newton_second_law']
    let answer: string = lessonKey ? answerFromLesson(lessonKey, outputMode, emotion, language) : ''
    let diagram: string = lesson.diagram
    let graphPath: string[] = [...lesson.path]
    let source = genAI ? 'local-graphrag-fallback-after-gemini-error' : 'local-graphrag-fallback-no-key'

    try {
      if (!lessonKey) {
        const dynamic = await dynamicGeminiNode({
          question,
          selectedSubject,
          outputMode,
          emotion,
          inputLanguage,
          targetLanguage,
          conceptMemory,
        })
        answer = dynamic.answer
        diagram = dynamic.diagram
        graphPath = dynamic.graphPath
        source = 'gemini-dynamic-graphrag'
      } else {
        const prompt = `You are VoicePandita, a Bangla tutor for SSC/HSC/admission students.
Answer the student's exact question using ONLY this curriculum node.

Graph path: ${lesson.path.join(' -> ')}
Lesson title: ${lesson.title}
Facts:
${lesson.facts.join('\n')}

Student question: ${question}
Emotion: ${emotion}
Detected input language: ${inputLanguage}
Selected target language: ${targetLanguage}
Mode: ${outputMode}

Rules:
- Answer in Bangla first. A separate language router will convert it or safely fall back.
- Must answer the exact question. Do not switch to another bonding/concept.
- Max 120 words unless exam mode.
- If confused, use an analogy first.
- End with one Socratic follow-up question.`

        const generated = await geminiText(prompt)
        if (generated) {
          answer = generated
          source = 'gemini-graphrag'
        }
      }
    } catch (err) {
      console.warn('/api/ask Gemini unavailable; deterministic curriculum fallback used', err instanceof Error ? err.message : err)
      if (!answer) answer = answerFromLesson(defaultBySubject[selectedSubject] || 'newton_second_law', outputMode, emotion, language)
    }

    let finalAnswer = answer
    let finalDiagram: string | null = diagram
    let languageSource = source

    if (targetLanguage === 'Chakma') {
      finalAnswer = await translateBanglaAnswerToChakma(answer, bridge)
      finalDiagram = localizeDiagram(diagram, targetLanguage, bridge)
      languageSource = `${source}+chakma-${bridge.source}`
    } else if (targetLanguage === 'Marma') {
      finalAnswer = await translateBanglaAnswerToMarma({
        banglaAnswer: answer,
        originalQuestion,
        inputLanguage,
        subjectContext: Array.isArray(graphPath) ? graphPath.join(' -> ') : selectedSubject,
      })
      finalDiagram = localizeDiagram(diagram, targetLanguage, bridge)
      languageSource = `${source}+marma-corpus-bridge`
    } else if (targetLanguage === 'Garo') {
      finalAnswer = await maybeGenerateLowResourceAnswer({
        banglaAnswer: answer,
        originalQuestion,
        inputLanguage,
        targetLanguage,
        subjectContext: Array.isArray(graphPath) ? graphPath.join(' -> ') : selectedSubject,
      })
      finalDiagram = localizeDiagram(diagram, targetLanguage, bridge)
      languageSource = `${source}+${targetLanguage.toLowerCase()}-safe-routing`
    }

    return NextResponse.json({
      answer: finalAnswer,
      diagram: outputMode === 'simple' || outputMode === 'exam' ? null : finalDiagram,
      detectedEmotion,
      detectedLanguage: inputLanguage,
      selectedTargetLanguage: targetLanguage,
      translatedQuestion: bridge.enabled && question !== originalQuestion ? question : null,
      graphPath,
      pwnMessage: 'তুমি একা নও - এই concept নিয়ে অনেক student আটকে যায়।',
      source: languageSource,
    })
  } catch (err) {
    console.error('/api/ask error:', err)
    return NextResponse.json({ answer: 'দুঃখিত, এখন উত্তর তৈরি করা যাচ্ছে না। আবার চেষ্টা করো।', diagram: null }, { status: 500 })
  }
}
