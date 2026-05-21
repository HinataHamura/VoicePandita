import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  formatChakmaExamples,
  prepareChakmaBridge,
  selectChakmaExamples,
  translateBanglaWithDataset,
  type ChakmaBridgeContext,
} from '@/lib/chakmaBridge'

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
    return translated?.trim() || datasetFallback
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

async function dynamicGeminiNode(params: {
  question: string
  selectedSubject: string
  outputMode: OutputMode
  emotion: EmotionState
  language: string
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
Language: ${params.language}
Output mode: ${params.outputMode}
Recent student concept memory:
${memoryText || 'None'}

Return ONLY valid JSON with this shape:
{
  "subject": "Physics/Chemistry/Biology/Math/Bangla/English",
  "conceptTitle": "short concept title",
  "graphPath": ["Subject", "Chapter", "Topic", "Subtopic"],
  "answer": "Bangla answer, max 130 words, exact to the question, no unrelated concept",
  "diagram": "valid Mermaid graph LR diagram with 4-6 nodes using Bangla labels"
}

Rules:
- Infer the true school subject from the question first; the selected subject may be wrong.
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const originalQuestion = String(body.question || '').trim()
    if (!originalQuestion) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const outputMode = String(body.outputMode || 'whiteboard') as OutputMode
    const language = String(body.language || 'bn')
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
          language,
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
Language: ${language}
Mode: ${outputMode}

Rules:
- Answer in Bangla.
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

    const finalAnswer = bridge.enabled
      ? await translateBanglaAnswerToChakma(answer, bridge)
      : answer
    const finalDiagram = bridge.enabled
      ? translateBanglaWithDataset(diagram, bridge.pairs)
      : diagram

    return NextResponse.json({
      answer: finalAnswer,
      diagram: outputMode === 'simple' || outputMode === 'exam' ? null : finalDiagram,
      detectedEmotion,
      detectedLanguage: bridge.enabled ? 'ccp' : language,
      translatedQuestion: bridge.enabled && question !== originalQuestion ? question : null,
      graphPath,
      pwnMessage: 'তুমি একা নও - এই concept নিয়ে অনেক student আটকে যায়।',
      source: bridge.enabled ? `${source}+chakma-${bridge.source}` : source,
    })
  } catch (err) {
    console.error('/api/ask error:', err)
    return NextResponse.json({ answer: 'দুঃখিত, এখন উত্তর তৈরি করা যাচ্ছে না। আবার চেষ্টা করো।', diagram: null }, { status: 500 })
  }
}
