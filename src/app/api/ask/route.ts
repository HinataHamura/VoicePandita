import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation'
type AnimationKey = 'newton_second_law' | 'photosynthesis' | 'minerals' | 'generic_concept'
type EmotionState = 'confident' | 'confused' | 'frustrated'

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null
const groqKey = process.env.GROQ_API_KEY?.trim()
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null

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

function selectedAnimationKey(question: string, mode: OutputMode, lessonKey: LessonKey | null): AnimationKey | null {
  if (mode !== 'animation') return null
  if (lessonKey === 'newton_second_law' || lessonKey === 'photosynthesis') return lessonKey

  const normalized = question.toLowerCase()
  if (/(খনিজ|খনিজ|mineral|khonij|crystal)/i.test(normalized)) return 'minerals'
  if (/(photosynthesis|সালোক|chlorophyll|co2|oxygen)/i.test(normalized)) return 'photosynthesis'
  if (/(newton|2nd law|second law|f\s*=\s*ma|force)/i.test(normalized)) return 'newton_second_law'

  return 'generic_concept'
}

function polishMermaidDiagram(diagram: string) {
  const trimmed = diagram.trim()
  if (!/^(graph|flowchart)\s+/i.test(trimmed)) return trimmed
  if (/classDef\s+/i.test(trimmed)) return trimmed

  const nodeIds = Array.from(trimmed.matchAll(/^\s*([A-Za-z][\w-]*)\[/gm)).map(match => match[1])
  const [root, ...rest] = nodeIds
  const last = rest.slice(-2)
  const middle = rest.slice(0, Math.max(0, rest.length - 2))

  const classLines = [
    'classDef root fill:#EEF2FF,stroke:#6366F1,stroke-width:2px,color:#1E293B;',
    'classDef idea fill:#ECFEFF,stroke:#14B8A6,stroke-width:1.6px,color:#164E63;',
    'classDef result fill:#FFF7ED,stroke:#FDBA74,stroke-width:1.8px,color:#7C2D12;',
  ]
  if (root) classLines.push(`class ${root} root;`)
  if (middle.length) classLines.push(`class ${middle.join(',')} idea;`)
  if (last.length) classLines.push(`class ${last.join(',')} result;`)

  return `${trimmed}\n  ${classLines.join('\n  ')}`
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

function unknownQuestionFallback(question: string, selectedSubject: string, emotion: EmotionState) {
  const intro = introFor(emotion)
  return `${intro} এই প্রশ্নের জন্য নির্ভরযোগ্য curriculum context পাচ্ছি না, তাই ভুল concept ধরে উত্তর দিচ্ছি না। প্রশ্নটা "${question.slice(0, 80)}"। যদি এটা তরলের চাপ/প্রবাহ নিয়ে হয়, মূল ধারণা হলো: তরল পাত্রের দেয়াল ও নিচের দিকে চাপ দেয়, আর গভীরতা বাড়লে চাপ বাড়ে। তুমি কি "তরলের চাপ" বোঝাতে চেয়েছ, নাকি "তরলের প্রবাহ"?`
}

function directFallbackAnswer(question: string, emotion: EmotionState) {
  const intro = introFor(emotion)
  return `${intro} প্রশ্নটা "${question.slice(0, 80)}"। যদি এটা তরলের চাপ/প্রবাহ নিয়ে হয়, মূল ধারণা হলো: তরল পাত্রের দেয়াল ও নিচের দিকে চাপ দেয়, আর গভীরতা বাড়লে চাপ বাড়ে। তরল সবদিকে চাপ প্রয়োগ করে, তাই পাত্রের আকার ও গভীরতা চাপের প্রভাব বদলায়। তুমি কি "তরলের চাপ" বোঝাতে চেয়েছ, নাকি "তরলের প্রবাহ"?`
}

function safeFallbackAnswer(question: string, emotion: EmotionState) {
  const intro = introFor(emotion)
  const normalized = question.toLowerCase()

  if (/খনিজ|ধনিজ|mineral/.test(normalized)) {
    return `${intro} খনিজ পদার্থ হলো মাটি বা ভূ-পৃষ্ঠের নিচ থেকে পাওয়া প্রাকৃতিক পদার্থ, যেগুলো মানুষের কাজে লাগে। উদাহরণ: লোহা, তামা, সোনা, রূপা, কয়লা, চুনাপাথর, লবণ, প্রাকৃতিক গ্যাস ও পেট্রোলিয়াম। এগুলো দিয়ে ঘরবাড়ি, যন্ত্রপাতি, গয়না, জ্বালানি ও রাসায়নিক দ্রব্য তৈরি করা হয়। Socratic check: খনিজ পদার্থের মধ্যে কোনগুলো জ্বালানি হিসেবে ব্যবহার হয়?`
  }

  if (/তরল|liquid|fluid/.test(normalized)) {
    return `${intro} তরল পদার্থের নির্দিষ্ট আয়তন থাকে, কিন্তু নির্দিষ্ট আকার থাকে না; যে পাত্রে রাখা হয় তার আকার ধারণ করে। পানি, তেল, দুধ, কেরোসিন এগুলো তরল পদার্থের উদাহরণ। তরল সহজে প্রবাহিত হয় এবং পাত্রের দেয়াল ও নিচের দিকে চাপ দেয়। Socratic check: পানি গ্লাসে রাখলে কেন গ্লাসের আকার নেয়?`
  }

  return `${intro} প্রশ্নটা "${question.slice(0, 80)}"। সহজভাবে বললে, এই প্রশ্নের মূল শব্দগুলো আগে চিহ্নিত করতে হবে, তারপর সংজ্ঞা, উদাহরণ এবং ব্যবহার লিখতে হবে। তুমি প্রশ্নটা আরেকটু নির্দিষ্ট করে লিখলে আমি exact chapter অনুযায়ী উত্তর সাজিয়ে দেব। Socratic check: প্রশ্নে কোন শব্দটা সবচেয়ে গুরুত্বপূর্ণ মনে হচ্ছে?`
}

function safeFallbackGraphPath(question: string, selectedSubject: string) {
  const normalized = question.toLowerCase()
  if (/খনিজ|ধনিজ|mineral/.test(normalized)) return ['Geography', 'Natural Resources', 'Minerals']
  if (/তরল|liquid|fluid/.test(normalized)) return ['Physics', 'Matter', 'Liquid']
  return [selectedSubject || 'Curriculum', 'General Question']
}

async function geminiText(prompt: string) {
  const requested = process.env.GEMINI_MODEL?.trim()
  const models = requested
    ? [requested, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']
    : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']

  let lastError: unknown = null
  if (genAI) {
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        return result.response.text().trim()
      } catch (err) {
        lastError = err
        console.warn(`/api/ask Gemini model failed: ${modelName}`, err instanceof Error ? err.message : err)
      }
    }
  }

  if (groq) {
    try {
      const result = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 700,
      })
      return result.choices[0]?.message?.content?.trim() || null
    } catch (err) {
      lastError = err
      console.warn('/api/ask Groq fallback failed:', err instanceof Error ? err.message : err)
    }
  }

  if (!lastError) return null
  throw lastError
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

function fallbackDiagramForQuestion(question: string, fallbackTitle: string) {
  const normalized = question.toLowerCase()
  if (/খনিজ|ধনিজ|mineral/.test(normalized)) {
    return 'graph LR\n  A[প্রাকৃতিক উৎস] --> B[খনিজ পদার্থ]\n  B --> C[ধাতব খনিজ]\n  B --> D[অধাতব খনিজ]\n  B --> E[জ্বালানি খনিজ]\n  C --> F[লোহা ও তামা]\n  D --> G[লবণ ও চুনাপাথর]\n  E --> H[কয়লা ও গ্যাস]'
  }
  if (/তরল|liquid|fluid/.test(normalized)) {
    return 'graph LR\n  A[তরল পদার্থ] --> B[নির্দিষ্ট আয়তন]\n  A --> C[নির্দিষ্ট আকার নেই]\n  A --> D[প্রবাহিত হয়]\n  A --> E[চাপ প্রয়োগ করে]\n  C --> F[পাত্রের আকার নেয়]'
  }
  return safeDiagram(null, fallbackTitle)
}

async function dynamicGeminiNode(params: {
  question: string
  selectedSubject: string
  outputMode: OutputMode
  emotion: EmotionState
  language: string
  conceptMemory: unknown
  curriculumChunks?: Array<{
    content: string
    contextText?: string
    context_text?: string
    contextual_summary?: string
    topic: string
    chapter?: string
    chunk_type?: string
    similarity: number
  }>
}) {
  const memoryText = Array.isArray(params.conceptMemory)
    ? params.conceptMemory
        .slice(0, 6)
        .map((item: any) => Array.isArray(item.graphPath) ? item.graphPath.join(' -> ') : '')
        .filter(Boolean)
        .join('\n')
    : ''

  const curriculumContext = Array.isArray(params.curriculumChunks) && params.curriculumChunks.length > 0
    ? '\n\nCurriculum context (from vector search):\n' +
      params.curriculumChunks
        .map((chunk, i) => {
          const contextText = chunk.contextText || chunk.context_text || [chunk.contextual_summary, chunk.content].filter(Boolean).join('\n\n')
          const chunkMeta = [chunk.chapter, chunk.topic, chunk.chunk_type].filter(Boolean).join(' / ')
          return `${i + 1}. [${chunkMeta || chunk.topic}] ${contextText}`
        })
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
${memoryText || 'None'}${curriculumContext}

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
- Use curriculum context if available to ground your answer.
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

async function directGeminiAnswer(params: {
  question: string
  selectedSubject: string
  outputMode: OutputMode
  emotion: EmotionState
  language: string
}) {
  const prompt = `You are VoicePandita, a careful Bangla tutor and concept-map builder for SSC/HSC/admission students in Bangladesh.

Student question: ${params.question}
Selected subject from UI (weak hint only, may be wrong): ${params.selectedSubject}
Emotion: ${params.emotion}
Language: ${params.language}
Output mode: ${params.outputMode}

Return ONLY valid JSON with this shape:
{
  "subject": "best inferred subject in English",
  "conceptTitle": "short English concept title",
  "graphPath": ["Subject", "Chapter/Unit", "Concept"],
  "answer": "Bangla answer, exact to the question, 4-6 clear sentences",
  "diagram": "valid Mermaid graph LR diagram with 5-8 Bangla-labeled nodes, specific to the answer"
}

Rules:
- Do not say curriculum context is missing.
- Do not switch to Newton's law, bonding, or another unrelated concept.
- Infer the true subject from the question; ignore the selected subject if it is wrong.
- If the question has typo/mixed Bangla-English, infer the likely intended school concept.
- If the question is ambiguous, give the most likely answer first, then ask one short clarifying question.
- Answer should usually be 70-130 words unless simple mode.
- Diagram must not be generic like Question -> Cause -> Result -> Understand.
- Diagram nodes must name the actual concept, types, examples, properties, or process steps.
- Diagram must use this Mermaid style: graph LR\\n  A[মূল ধারণা] --> B[প্রকার]\\n  B --> C[উদাহরণ]
- End with one Socratic follow-up question.`

  const raw = await geminiText(prompt)
  if (!raw) throw new Error('Gemini unavailable')

  try {
    const parsed = extractJson(raw)
    const conceptTitle = String(parsed.conceptTitle || params.question.slice(0, 30) || 'Concept')
    const graphPath = Array.isArray(parsed.graphPath) && parsed.graphPath.length >= 2
      ? parsed.graphPath.map((part: unknown) => String(part)).slice(0, 6)
      : [String(parsed.subject || params.selectedSubject || 'Curriculum'), conceptTitle]

    return {
      answer: String(parsed.answer || raw).trim(),
      diagram: safeDiagram(parsed.diagram, conceptTitle),
      graphPath,
    }
  } catch {
    const conceptTitle = params.question.slice(0, 30) || 'Concept'
    return {
      answer: raw,
      diagram: fallbackDiagramForQuestion(params.question, conceptTitle),
      graphPath: safeFallbackGraphPath(params.question, params.selectedSubject),
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const question = String(body.question || '').trim()
    if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const outputMode = String(body.outputMode || 'whiteboard') as OutputMode
    const language = String(body.language || 'bn')
    const repeatCount = Number(body.repeatCount || 0)
    const selectedSubject = String(body.subject || 'physics')
    const curriculumChunks = Array.isArray(body.curriculumChunks) ? body.curriculumChunks : undefined
    const lessonKey = inferLesson(question)
    const detectedEmotion = detectEmotion(question, repeatCount)
    const emotion = (body.emotion || detectedEmotion) as EmotionState
    const conceptMemory = body.conceptMemory
    const animationKey = selectedAnimationKey(question, outputMode, lessonKey)

    let lesson = lessonKey ? LESSONS[lessonKey] : null
    let answer: string = lessonKey ? answerFromLesson(lessonKey, outputMode, emotion, language) : ''
    let diagram: string = lesson?.diagram || safeDiagram(null, question.slice(0, 30) || 'Concept')
    let graphPath: string[] = lesson ? [...lesson.path] : [selectedSubject || 'Curriculum', 'Needs Clarification']
    let source = genAI ? 'local-graphrag-fallback-after-gemini-error' : 'local-graphrag-fallback-no-key'

    try {
      if (!lessonKey) {
        const dynamic = await directGeminiAnswer({
          question,
          selectedSubject,
          outputMode,
          emotion,
          language,
        })
        answer = dynamic.answer
        diagram = dynamic.diagram
        graphPath = dynamic.graphPath
        source = 'gemini-direct-answer'
      } else {
        const activeLesson = lesson
        if (!activeLesson) throw new Error('Lesson not found')
        const prompt = `You are VoicePandita, a Bangla tutor for SSC/HSC/admission students.
Answer the student's exact question using ONLY this curriculum node.

Graph path: ${activeLesson.path.join(' -> ')}
Lesson title: ${activeLesson.title}
Facts:
${activeLesson.facts.join('\n')}

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
      console.warn('/api/ask Gemini unavailable', err instanceof Error ? err.message : err)
      if (!answer) {
        throw err
      }
    }

    return NextResponse.json({
      answer,
      diagram: outputMode === 'simple' || outputMode === 'exam' ? null : polishMermaidDiagram(diagram),
      animationKey,
      detectedEmotion,
      graphPath,
      pwnMessage: 'তুমি একা নও - এই concept নিয়ে অনেক student আটকে যায়।',
      source,
    })
  } catch (err) {
    console.error('/api/ask error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        answer: 'দুঃখিত, এখন উত্তর তৈরি করা যাচ্ছে না। আবার চেষ্টা করো।',
        diagram: null,
        error: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
    return NextResponse.json({ answer: 'দুঃখিত, এখন উত্তর তৈরি করা যাচ্ছে না। আবার চেষ্টা করো।', diagram: null }, { status: 500 })
  }
}
