import { GoogleGenerativeAI } from '@google/generative-ai'
import type { StudyBuddyQuiz } from './types'

const genAI = process.env.GEMINI_API_KEY?.trim()
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim())
  : null

const fallbackBanks: Record<string, Omit<StudyBuddyQuiz, 'topicTitle'>> = {
  "newton's second law": {
    learningGoalBn: "Newton's Second Law দিয়ে force, mass, acceleration-এর সম্পর্ক ব্যাখ্যা করতে পারা।",
    warmupBn: 'ব্যক্তিগত তথ্য নয়, শুধু concept নিয়ে আলোচনা করো। আজ আমরা F = m × a বুঝে practice করব।',
    closingSummaryBn: "আজকে Newton's Second Law-এ F = m × a, a = F / m, আর বাস্তব উদাহরণ দিয়ে mass-force-acceleration বুঝেছো।",
    questions: [
      {
        questionOrder: 1,
        questionType: 'mcq',
        promptBn: 'একই force দিলে ২ kg বস্তুর তুলনায় ৪ kg বস্তুর acceleration কেমন হবে?',
        options: [
          { id: 'A', text: 'কম হবে, কারণ mass বেশি' },
          { id: 'B', text: 'বেশি হবে, কারণ mass বেশি' },
          { id: 'C', text: 'একই থাকবে' },
          { id: 'D', text: 'force শূন্য হয়ে যাবে' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'F = m × a থেকে a = F / m.',
        explanationBn: 'একই force হলে mass যত বেশি, acceleration তত কম হয়। তাই ৪ kg বস্তুর acceleration ২ kg বস্তুর চেয়ে কম হবে।',
        difficulty: 'easy',
        conceptTag: 'force-mass-acceleration',
      },
      {
        questionOrder: 2,
        questionType: 'mcq',
        promptBn: 'একটি খালি ঠেলাগাড়ি আর ভরা ঠেলাগাড়িতে একই ধাক্কা দিলে কোনটি দ্রুত গতি বদলায়?',
        options: [
          { id: 'A', text: 'খালি ঠেলাগাড়ি' },
          { id: 'B', text: 'ভরা ঠেলাগাড়ি' },
          { id: 'C', text: 'দুটিই সমান' },
          { id: 'D', text: 'কোনোটিই নড়ে না' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'কম mass হলে একই force-এ acceleration বেশি হয়।',
        explanationBn: "খালি ঠেলাগাড়ির mass কম, তাই একই ধাক্কায় তার acceleration বেশি হয়। এটা Newton's Second Law-এর বাস্তব উদাহরণ।",
        difficulty: 'easy',
        conceptTag: 'daily-example',
      },
      {
        questionOrder: 3,
        questionType: 'mcq',
        promptBn: 'একটি ৩ kg বস্তুকে ১২ N force দিলে acceleration কত?',
        options: [
          { id: 'A', text: '৪ m/s²' },
          { id: 'B', text: '৯ m/s²' },
          { id: 'C', text: '১৫ m/s²' },
          { id: 'D', text: '৩৬ m/s²' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'a = F / m = 12 / 3.',
        explanationBn: "Newton's Second Law অনুযায়ী F = m × a, তাই a = F / m = ১২ / ৩ = ৪ m/s²।",
        difficulty: 'medium',
        conceptTag: 'calculation',
      },
      {
        questionOrder: 4,
        questionType: 'mcq',
        promptBn: 'Mass একই রেখে acceleration দ্বিগুণ করতে হলে force কী করতে হবে?',
        options: [
          { id: 'A', text: 'Force দ্বিগুণ করতে হবে' },
          { id: 'B', text: 'Force অর্ধেক করতে হবে' },
          { id: 'C', text: 'Mass দ্বিগুণ করতে হবে' },
          { id: 'D', text: 'Force শূন্য করতে হবে' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'm fixed থাকলে F সরাসরি a-এর সাথে বাড়ে।',
        explanationBn: 'F = m × a-তে mass fixed থাকলে acceleration বাড়াতে force একই অনুপাতে বাড়াতে হয়।',
        difficulty: 'medium',
        conceptTag: 'proportionality',
      },
      {
        questionOrder: 5,
        questionType: 'mcq',
        promptBn: "Newton's Second Law আসলে কোন সম্পর্কটি বোঝায়?",
        options: [
          { id: 'A', text: 'Force, mass, acceleration-এর সম্পর্ক' },
          { id: 'B', text: 'শুধু বস্তুর রং' },
          { id: 'C', text: 'শুধু দূরত্ব মাপা' },
          { id: 'D', text: 'শুধু তাপমাত্রা বদল' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'সূত্রটি F = m × a.',
        explanationBn: 'এই সূত্র বলে net force হলো mass ও acceleration-এর গুণফল। force বাড়লে acceleration বাড়তে পারে, আর mass বাড়লে একই force-এ acceleration কমে।',
        difficulty: 'easy',
        conceptTag: 'summary',
      },
    ],
  },
  photosynthesis: {
    learningGoalBn: 'উদ্ভিদ কীভাবে আলো ব্যবহার করে খাদ্য তৈরি করে তা ব্যাখ্যা করতে পারা।',
    warmupBn: 'ব্যক্তিগত তথ্য নয়, শুধু concept নিয়ে আলোচনা করো। আজ আমরা photosynthesis-এর ধাপ বুঝব।',
    closingSummaryBn: 'আজকে photosynthesis-এ আলো, chlorophyll, CO₂, পানি, glucose ও oxygen-এর ভূমিকা practice করলে।',
    questions: [
      {
        questionOrder: 1,
        questionType: 'mcq',
        promptBn: 'Photosynthesis-এ উদ্ভিদ প্রধানত কোন শক্তি ব্যবহার করে?',
        options: [
          { id: 'A', text: 'সূর্যের আলো' },
          { id: 'B', text: 'শব্দ' },
          { id: 'C', text: 'চুম্বক' },
          { id: 'D', text: 'ব্যাটারির চার্জ' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'পাতায় chlorophyll আলো ধরে।',
        explanationBn: 'উদ্ভিদ সূর্যের আলোর শক্তি ব্যবহার করে carbon dioxide ও পানি থেকে glucose তৈরি করে।',
        difficulty: 'easy',
        conceptTag: 'light-energy',
      },
      {
        questionOrder: 2,
        questionType: 'mcq',
        promptBn: 'Photosynthesis-এর জন্য কোন দুইটি raw material দরকার?',
        options: [
          { id: 'A', text: 'Carbon dioxide ও পানি' },
          { id: 'B', text: 'Oxygen ও glucose' },
          { id: 'C', text: 'লবণ ও তেল' },
          { id: 'D', text: 'Nitrogen ও শব্দ' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'পাতা বাতাস থেকে CO₂ নেয়, শিকড় পানি নেয়।',
        explanationBn: 'Photosynthesis-এ CO₂ ও H₂O ব্যবহার করে glucose তৈরি হয় এবং oxygen বের হয়।',
        difficulty: 'easy',
        conceptTag: 'raw-materials',
      },
      {
        questionOrder: 3,
        questionType: 'mcq',
        promptBn: 'পাতা সবুজ দেখায় কোন pigment-এর কারণে?',
        options: [
          { id: 'A', text: 'Chlorophyll' },
          { id: 'B', text: 'Hemoglobin' },
          { id: 'C', text: 'Melanin' },
          { id: 'D', text: 'Keratin' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'এই pigment আলো absorb করতে সাহায্য করে।',
        explanationBn: 'Chlorophyll পাতাকে সবুজ দেখায় এবং আলো absorb করে photosynthesis চালাতে সাহায্য করে।',
        difficulty: 'easy',
        conceptTag: 'chlorophyll',
      },
      {
        questionOrder: 4,
        questionType: 'mcq',
        promptBn: 'রাতে আলো না থাকলে photosynthesis কেন কমে যায়?',
        options: [
          { id: 'A', text: 'আলোর শক্তি পাওয়া যায় না' },
          { id: 'B', text: 'পাতা পানি খেতে পারে না' },
          { id: 'C', text: 'মাটি অদৃশ্য হয়ে যায়' },
          { id: 'D', text: 'CO₂ থাকে না' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'Photosynthesis light-dependent process.',
        explanationBn: 'আলো না থাকলে chlorophyll পর্যাপ্ত light energy পায় না, তাই photosynthesis কমে যায়।',
        difficulty: 'medium',
        conceptTag: 'light-dependence',
      },
      {
        questionOrder: 5,
        questionType: 'mcq',
        promptBn: 'Photosynthesis-এর useful product কোনটি?',
        options: [
          { id: 'A', text: 'Glucose' },
          { id: 'B', text: 'ধোঁয়া' },
          { id: 'C', text: 'ধুলা' },
          { id: 'D', text: 'শব্দ' },
        ],
        correctAnswer: { id: 'A' },
        hintBn: 'উদ্ভিদ নিজের খাদ্য হিসেবে এটি বানায়।',
        explanationBn: 'Glucose হলো উদ্ভিদের তৈরি খাদ্য। Oxygen উপজাত হিসেবে বাতাসে বের হয়।',
        difficulty: 'easy',
        conceptTag: 'product',
      },
    ],
  },
}

function genericFallback(topicTitle: string): StudyBuddyQuiz {
  return {
    topicTitle,
    learningGoalBn: `${topicTitle} ধারণাটি উদাহরণ দিয়ে ব্যাখ্যা করতে পারা।`,
    warmupBn: 'ব্যক্তিগত তথ্য নয়, শুধু topic নিয়ে আলোচনা করো।',
    closingSummaryBn: `আজকে ${topicTitle} নিয়ে concept, example, hint এবং explanation practice করলে।`,
    questions: [1, 2, 3, 4, 5].map(order => ({
      questionOrder: order,
      questionType: 'mcq' as const,
      promptBn: `${topicTitle} বুঝতে কোন পদ্ধতিটি সবচেয়ে ভালো সাহায্য করে?`,
      options: [
        { id: 'A', text: 'মূল ধারণা, কারণ, উদাহরণ আলাদা করা' },
        { id: 'B', text: 'শুধু শব্দ মুখস্থ করা' },
        { id: 'C', text: 'এলোমেলো guess করা' },
        { id: 'D', text: 'সহপাঠীকে distract করা' },
      ],
      correctAnswer: { id: 'A' },
      hintBn: 'Concept বুঝতে definition-এর সাথে example দরকার।',
      explanationBn: `${topicTitle} ভালোভাবে বুঝতে নিজের ভাষায় ব্যাখ্যা, ছোট উদাহরণ, আর ভুল ধারণা ঠিক করা জরুরি।`,
      difficulty: order >= 3 ? 'medium' as const : 'easy' as const,
      conceptTag: 'conceptual',
    })),
  }
}

function fallbackQuestions(topicTitle: string): StudyBuddyQuiz {
  const normalized = topicTitle.toLowerCase().trim()
  const key = Object.keys(fallbackBanks).find(item => normalized.includes(item))
  if (!key) return genericFallback(topicTitle)
  return { topicTitle, ...fallbackBanks[key] }
}

function hasCuratedFallback(topicTitle: string) {
  const normalized = topicTitle.toLowerCase().trim()
  return Object.keys(fallbackBanks).some(item => normalized.includes(item))
}

export function isWeakStudyBuddyQuestion(question: { prompt_bn?: string | null; options?: unknown }) {
  const prompt = String(question.prompt_bn || '').toLowerCase()
  const optionsText = JSON.stringify(question.options || '').toLowerCase()
  return (
    prompt.includes('কোন উত্তরটি সবচেয়ে যুক্তিযুক্ত') ||
    prompt.includes('concept-check') ||
    optionsText.includes('ব্যক্তিগত তথ্য') ||
    optionsText.includes('personal info') ||
    optionsText.includes('প্রশ্ন না পড়ে')
  )
}

function parseQuizJson(text: string, topicTitle: string): StudyBuddyQuiz {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== 5) throw new Error('Quiz must have exactly 5 questions')

  const questions = parsed.questions.slice(0, 5).map((q: any, index: number) => {
    const options = Array.isArray(q.options)
      ? q.options.slice(0, 4).map((option: any, optionIndex: number) => ({
          id: String(option.id || String.fromCharCode(65 + optionIndex)).slice(0, 4),
          text: String(option.text || option).slice(0, 180),
        }))
      : []

    if (!String(q.promptBn || q.prompt || '').trim() || options.length !== 4) throw new Error('Quiz question is incomplete')

    return {
      questionOrder: Number(q.questionOrder || index + 1),
      questionType: 'mcq' as const,
      promptBn: String(q.promptBn || q.prompt).slice(0, 500),
      options,
      correctAnswer: { id: String(q.correctAnswer?.id || q.correct_answer?.id || options[0]?.id || 'A').slice(0, 4) },
      hintBn: String(q.hintBn || q.hint || '').slice(0, 240),
      explanationBn: String(q.explanationBn || q.explanation || 'উত্তরটি ধারণা বুঝে মিলিয়ে দেখো।').slice(0, 700),
      difficulty: q.difficulty === 'medium' ? 'medium' as const : 'easy' as const,
      conceptTag: String(q.conceptTag || 'conceptual').slice(0, 80),
    }
  })

  return {
    topicTitle: String(parsed.topicTitle || topicTitle).slice(0, 120),
    learningGoalBn: String(parsed.learningGoalBn || `${topicTitle} বোঝা`).slice(0, 300),
    warmupBn: String(parsed.warmupBn || 'চলো concept practice করি। ব্যক্তিগত তথ্য শেয়ার করো না।').slice(0, 400),
    questions,
    closingSummaryBn: String(parsed.closingSummaryBn || `${topicTitle} নিয়ে আজকের অনুশীলন শেষ।`).slice(0, 700),
  }
}

export async function generateStudyBuddyQuiz(topicTitle: string, subject?: string | null) {
  if (hasCuratedFallback(topicTitle)) return fallbackQuestions(topicTitle)
  if (!genAI) return fallbackQuestions(topicTitle)

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash' })
    const result = await model.generateContent(`You are VoicePandita's AI Study Buddy host for Bangladeshi students.
Create exactly 5 high-quality topic-specific MCQ concept questions.
Use simple Bangla with common English science terms when useful.
Include hints, explanations, and difficulty values of "easy" or "medium".
Do not generate generic study-advice questions.
Do not mention marks, board exam, admission, model test, or coaching.
Do not invent words in Chakma, Marma, or Garo.
Return valid JSON only.

Topic: ${topicTitle}
Subject: ${subject || 'general'}
Schema:
{"topicTitle":"string","learningGoalBn":"string","warmupBn":"string","questions":[{"questionOrder":1,"questionType":"mcq","promptBn":"string","options":[{"id":"A","text":"string"},{"id":"B","text":"string"},{"id":"C","text":"string"},{"id":"D","text":"string"}],"correctAnswer":{"id":"A"},"hintBn":"string","explanationBn":"string","difficulty":"easy","conceptTag":"string"}],"closingSummaryBn":"string"}`)
    return parseQuizJson(result.response.text(), topicTitle)
  } catch (error) {
    console.warn('[study_buddy] quiz generation fallback', error)
    return fallbackQuestions(topicTitle)
  }
}
