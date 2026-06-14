import { GoogleGenerativeAI } from '@google/generative-ai'
import type { StudyBuddyQuiz } from './types'

const genAI = process.env.GEMINI_API_KEY?.trim()
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim())
  : null

const questionMoves = [
  'main-idea',
  'real-life-example',
  'common-mistake',
  'cause-effect',
  'teach-a-friend',
] as const

const optionIds = ['A', 'B', 'C', 'D']
type QuizOption = { id: string; text: string }

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasRepeatedQuestionShape(prompts: string[]) {
  const normalized = prompts.map(normalizeText)
  const unique = new Set(normalized)
  if (unique.size !== normalized.length) return true

  const repeatedStems = [
    'কোন উত্তরটি সবচেয়ে যুক্তিযুক্ত',
    'কোনটি সঠিক',
    'which answer is most logical',
    'concept check',
  ]

  return repeatedStems.some(stem => prompts.filter(prompt => normalizeText(prompt).includes(normalizeText(stem))).length > 1)
}

export function isWeakStudyBuddyQuestion(question: { prompt_bn?: string | null; options?: unknown }) {
  const prompt = normalizeText(question.prompt_bn || '')
  if (prompt.length < 12) return true

  const options = Array.isArray(question.options) ? question.options : []
  if (options.length < 4) return true

  const optionTexts = options.map((option: any) => normalizeText(String(option?.text || option || '')))
  if (optionTexts.some(text => text.length < 2)) return true
  if (new Set(optionTexts).size !== optionTexts.length) return true

  const weakStems = ['concept check', 'which answer is most logical']
  return weakStems.some(stem => prompt === normalizeText(stem) || prompt.startsWith(normalizeText(stem)))
}

function fallbackQuestion(topicTitle: string, order: number, move: (typeof questionMoves)[number]) {
  const variants = {
    'main-idea': {
      promptBn: `${topicTitle} বোঝার জন্য সবচেয়ে আগে কোন ধারণাটা পরিষ্কার হওয়া দরকার?`,
      options: [
        'মূল সম্পর্কটা নিজের ভাষায় বলা',
        'শুধু সংজ্ঞা মুখস্থ করা',
        'বন্ধুর উত্তর কপি করা',
        'প্রশ্ন না পড়ে অপশন দেখা',
      ],
      hintBn: 'যে অপশনটা বুঝে বলার কথা বলছে, সেটাই খুঁজো।',
      explanationBn: `${topicTitle} শেখার শুরুতে সংজ্ঞা মুখস্থ করার চেয়ে মূল সম্পর্ক বা ধারণাটা নিজের ভাষায় বলতে পারা বেশি জরুরি।`,
      conceptTag: 'মূল ধারণা',
      correctIndex: 0,
      difficulty: 'easy' as const,
    },
    'real-life-example': {
      promptBn: `বাংলাদেশের দৈনন্দিন জীবনে ${topicTitle} বোঝাতে কোন উদাহরণটা সবচেয়ে কাজে লাগবে?`,
      options: [
        'বাস্তব কোনো ঘটনা দিয়ে ধারণার মিল খোঁজা',
        'বিষয়ের সঙ্গে সম্পর্ক নেই এমন গল্প বলা',
        'শুধু বইয়ের পৃষ্ঠা নম্বর মনে রাখা',
        'সব অপশন একই ধরে নেওয়া',
      ],
      hintBn: 'ভালো উদাহরণ ধারণাটাকে চোখের সামনে এনে দেয়।',
      explanationBn: `বাস্তব উদাহরণ ব্যবহার করলে ${topicTitle} শুধু শব্দ থাকে না, কাজের মধ্যে কীভাবে দেখা যায় সেটাও বোঝা যায়।`,
      conceptTag: 'বাস্তব উদাহরণ',
      correctIndex: 0,
      difficulty: 'easy' as const,
    },
    'common-mistake': {
      promptBn: `${topicTitle} শেখার সময় কোন ভুলটা করলে বোঝা দুর্বল হয়ে যায়?`,
      options: [
        'কারণ না বুঝে উত্তর মুখস্থ করা',
        'নিজের ভাষায় ছোট ব্যাখ্যা দেওয়া',
        'উদাহরণ দিয়ে যাচাই করা',
        'বন্ধুকে ধারণাটা শেখানোর চেষ্টা করা',
      ],
      hintBn: 'যে কাজটা বোঝার বদলে শুধু মুখস্থে ঠেলে দেয়, সেটাই সমস্যা।',
      explanationBn: `কারণ না বুঝে মুখস্থ করলে ${topicTitle} নতুন প্রশ্নে প্রয়োগ করা কঠিন হয়ে যায়।`,
      conceptTag: 'সাধারণ ভুল',
      correctIndex: 0,
      difficulty: 'medium' as const,
    },
    'cause-effect': {
      promptBn: `${topicTitle}-এ কারণ আর ফলাফল আলাদা করতে হলে কোন প্রশ্নটা করা ভালো?`,
      options: [
        'কোন কারণে কোন পরিবর্তন বা ফল হলো?',
        'কোন অপশন সবচেয়ে লম্বা?',
        'কে আগে উত্তর দিল?',
        'কোন শব্দটা সবচেয়ে কঠিন শোনায়?',
      ],
      hintBn: 'কারণ-ফল বুঝতে “কেন” এবং “এর ফলে কী” দুটোই দরকার।',
      explanationBn: `${topicTitle}-এ কারণ-ফল সম্পর্ক ধরতে পারলে শুধু উত্তর নয়, যুক্তিটাও পরিষ্কার হয়।`,
      conceptTag: 'কারণ ও ফল',
      correctIndex: 0,
      difficulty: 'medium' as const,
    },
    'teach-a-friend': {
      promptBn: `তুমি যদি একজন বন্ধুকে ${topicTitle} ৩০ সেকেন্ডে বোঝাও, সবচেয়ে ভালো শুরু কোনটা?`,
      options: [
        'প্রথমে সহজ ভাষায় মূল ধারণা, তারপর ছোট উদাহরণ',
        'প্রথমেই অনেক কঠিন টার্ম বলা',
        'শুধু বলব এটা পরীক্ষায় আসে',
        'ব্যাখ্যা না দিয়ে উত্তর বলে দেওয়া',
      ],
      hintBn: 'বন্ধুকে শেখাতে হলে সহজ ভাষা আর ছোট উদাহরণ সবচেয়ে কাজে দেয়।',
      explanationBn: `কাউকে শেখাতে গেলে ${topicTitle} নিজের কাছেও পরিষ্কার হয়, কারণ তখন ধারণা, উদাহরণ, এবং ভুল ধারণা আলাদা করতে হয়।`,
      conceptTag: 'বন্ধুকে শেখানো',
      correctIndex: 0,
      difficulty: 'easy' as const,
    },
  }[move]

  const correctText = variants.options[variants.correctIndex]
  const rotation = (order - 1) % optionIds.length
  const rotatedOptions = [...variants.options.slice(rotation), ...variants.options.slice(0, rotation)]
  const correctId = optionIds[rotatedOptions.findIndex(option => option === correctText)]

  return {
    questionOrder: order,
    questionType: 'mcq' as const,
    promptBn: variants.promptBn,
    options: rotatedOptions.map((text, index) => ({ id: optionIds[index], text })),
    correctAnswer: { id: correctId },
    hintBn: variants.hintBn,
    explanationBn: variants.explanationBn,
    difficulty: variants.difficulty,
    conceptTag: variants.conceptTag,
  }
}

function fallbackQuestions(topicTitle: string): StudyBuddyQuiz {
  return {
    topicTitle,
    learningGoalBn: `${topicTitle} নিয়ে মূল ধারণা, বাস্তব উদাহরণ, সাধারণ ভুল, কারণ-ফল, এবং বন্ধুকে বোঝানোর অনুশীলন করা।`,
    warmupBn: 'চলো ছোট একটা Bondhu practice করি। ব্যক্তিগত তথ্য শেয়ার করো না; আমরা নম্বরের জন্য না, বোঝার জন্য খেলব।',
    questions: questionMoves.map((move, index) => fallbackQuestion(topicTitle, index + 1, move)),
    closingSummaryBn: `আজকে তোমরা ${topicTitle} নিয়ে পাঁচভাবে ভেবেছ: মূল ধারণা, বাস্তব উদাহরণ, সাধারণ ভুল, কারণ-ফল, আর বন্ধুকে বোঝানো।`,
  }
}

function parseQuizJson(text: string, topicTitle: string): StudyBuddyQuiz {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== 5) throw new Error('Quiz must have exactly 5 questions')

  const questions: StudyBuddyQuiz['questions'] = parsed.questions.slice(0, 5).map((q: any, index: number) => {
    const options: QuizOption[] = Array.isArray(q.options)
      ? q.options.slice(0, 4).map((option: any, optionIndex: number) => ({
        id: optionIds.includes(String(option.id)) ? String(option.id) : optionIds[optionIndex],
        text: String(option.text || option).slice(0, 180),
      }))
      : []
    if (options.length !== 4 || options.some(option => !option.text.trim())) throw new Error('Each question needs 4 options')

    const correctId = String(q.correctAnswer?.id || q.correct_answer?.id || 'A').slice(0, 4)
    if (!options.some(option => option.id === correctId)) throw new Error('Correct answer must match an option')

    const promptBn = String(q.promptBn || q.prompt || '').slice(0, 500).trim()
    if (!promptBn) throw new Error('Question prompt is required')

    return {
      questionOrder: index + 1,
      questionType: 'mcq' as const,
      promptBn,
      options,
      correctAnswer: { id: correctId },
      hintBn: String(q.hintBn || q.hint || '').slice(0, 240),
      explanationBn: String(q.explanationBn || q.explanation || '').slice(0, 700),
      difficulty: q.difficulty === 'medium' ? 'medium' as const : 'easy' as const,
      conceptTag: String(q.conceptTag || questionMoves[index] || topicTitle).slice(0, 80),
    }
  })

  if (hasRepeatedQuestionShape(questions.map(question => question.promptBn))) {
    throw new Error('Generated quiz repeated question shapes')
  }

  return {
    topicTitle: String(parsed.topicTitle || topicTitle).slice(0, 120),
    learningGoalBn: String(parsed.learningGoalBn || `${topicTitle} বোঝা`).slice(0, 300),
    warmupBn: String(parsed.warmupBn || 'চলো concept practice করি।').slice(0, 400),
    questions,
    closingSummaryBn: String(parsed.closingSummaryBn || `${topicTitle} summary ready.`).slice(0, 700),
  }
}

export async function generateStudyBuddyQuiz(topicTitle: string, subject?: string | null) {
  if (!genAI) return fallbackQuestions(topicTitle)

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash' })
    const result = await model.generateContent(`You are VoicePandita's Bondhu Study Room host for Bangladeshi students.
Create one lively 10-minute guided group learning session as exactly 5 MCQ concept checks.
Return valid JSON only. Do not wrap in markdown.

Topic: ${topicTitle}
Subject: ${subject || 'general'}

Session personality:
- Warm, short, and peer-friendly, like a calm Bangla study group host.
- Use simple Bangla with occasional natural English study words only when useful.
- Use Bangladesh-relevant examples where the topic allows.
- No personal-data requests, no free-chat invitation, no shaming, no marks/exam pressure.

Anti-repetition rules:
- The 5 question prompts must feel clearly different from each other.
- Use these five learning moves in order:
  1. main idea in own words
  2. real-life or local example
  3. common misconception or trap
  4. cause-effect/process/relationship
  5. teach-a-friend or apply-to-new-situation
- Do not repeat a prompt stem such as "কোন উত্তরটি সবচেয়ে যুক্তিযুক্ত", "কোনটি সঠিক", or "concept-check".
- Do not make all correct answers option A. Distribute correct answers across A, B, C, and D.
- Each wrong option must represent a believable misconception, not a silly filler.
- Each hint must point to reasoning without giving the answer directly.
- Each explanation must explain why the correct answer works and why the common wrong idea fails.

Schema:
{"topicTitle":"string","learningGoalBn":"string","warmupBn":"string","questions":[{"questionOrder":1,"questionType":"mcq","promptBn":"string","options":[{"id":"A","text":"string"},{"id":"B","text":"string"},{"id":"C","text":"string"},{"id":"D","text":"string"}],"correctAnswer":{"id":"A"},"hintBn":"string","explanationBn":"string","difficulty":"easy","conceptTag":"string"}],"closingSummaryBn":"string"}`)
    return parseQuizJson(result.response.text(), topicTitle)
  } catch {
    return fallbackQuestions(topicTitle)
  }
}
