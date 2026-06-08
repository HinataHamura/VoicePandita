import { GoogleGenerativeAI } from '@google/generative-ai'
import type { StudyBuddyQuiz } from './types'

const genAI = process.env.GEMINI_API_KEY?.trim()
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim())
  : null

function fallbackQuestions(topicTitle: string): StudyBuddyQuiz {
  return {
    topicTitle,
    learningGoalBn: `${topicTitle} concept ta nijer ভাষায় বুঝতে পারা।`,
    warmupBn: 'Personal info share করো না। আমরা marks না, understanding practice করব।',
    questions: [1, 2, 3, 4, 5].map(order => ({
      questionOrder: order,
      questionType: 'mcq' as const,
      promptBn: order === 1
        ? `${topicTitle} শেখার সময় প্রথমে কোন জিনিসটা বোঝা দরকার?`
        : `${topicTitle} নিয়ে concept-check ${order}: কোন উত্তরটি সবচেয়ে যুক্তিযুক্ত?`,
      options: [
        { id: 'A', text: 'মূল ধারণা নিজের ভাষায় বলা' },
        { id: 'B', text: 'শুধু মুখস্থ করা' },
        { id: 'C', text: 'বন্ধুর personal info নেওয়া' },
        { id: 'D', text: 'প্রশ্ন না পড়ে উত্তর দেওয়া' },
      ],
      correctAnswer: { id: 'A' },
      hintBn: 'মুখস্থ না, বুঝে বলার দিকটা খেয়াল করো।',
      explanationBn: `${topicTitle} ভালোভাবে বুঝতে হলে সংজ্ঞা মুখস্থ করার চেয়ে কারণ, উদাহরণ, আর নিজের ভাষায় ব্যাখ্যা করা বেশি দরকার।`,
      difficulty: 'easy' as const,
      conceptTag: topicTitle,
    })),
    closingSummaryBn: `আজকে তোমরা ${topicTitle} নিয়ে মূল ধারণা, ভুল ধারণা, আর ছোট concept checks practice করলে।`,
  }
}

function parseQuizJson(text: string, topicTitle: string): StudyBuddyQuiz {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== 5) throw new Error('Quiz must have exactly 5 questions')
  return {
    topicTitle: String(parsed.topicTitle || topicTitle).slice(0, 120),
    learningGoalBn: String(parsed.learningGoalBn || `${topicTitle} বোঝা`).slice(0, 300),
    warmupBn: String(parsed.warmupBn || 'চলো concept practice করি।').slice(0, 400),
    questions: parsed.questions.slice(0, 5).map((q: any, index: number) => ({
      questionOrder: Number(q.questionOrder || index + 1),
      questionType: 'mcq' as const,
      promptBn: String(q.promptBn || q.prompt || '').slice(0, 500),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map((option: any, optionIndex: number) => ({
        id: String(option.id || String.fromCharCode(65 + optionIndex)).slice(0, 4),
        text: String(option.text || option).slice(0, 180),
      })) : [],
      correctAnswer: { id: String(q.correctAnswer?.id || q.correct_answer?.id || 'A').slice(0, 4) },
      hintBn: String(q.hintBn || q.hint || '').slice(0, 240),
      explanationBn: String(q.explanationBn || q.explanation || '').slice(0, 700),
      difficulty: q.difficulty === 'medium' ? 'medium' : 'easy',
      conceptTag: String(q.conceptTag || topicTitle).slice(0, 80),
    })),
    closingSummaryBn: String(parsed.closingSummaryBn || `${topicTitle} summary ready.`).slice(0, 700),
  }
}

export async function generateStudyBuddyQuiz(topicTitle: string, subject?: string | null) {
  if (!genAI) return fallbackQuestions(topicTitle)

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash' })
    const result = await model.generateContent(`You are VoicePandita's AI Study Buddy host for Bangladeshi students.
Create a 10-minute group learning session.
Do not generate board-exam style questions.
Do not mention marks, board exam, admission, model test, or coaching.
Focus on understanding.
Use simple Bangla.
Use local examples from Bangladesh.
Make questions safe, friendly, and short.
Questions must check concept understanding, not memorization.
Return valid JSON only.

Topic: ${topicTitle}
Subject: ${subject || 'general'}
Schema:
{"topicTitle":"string","learningGoalBn":"string","warmupBn":"string","questions":[{"questionOrder":1,"questionType":"mcq","promptBn":"string","options":[{"id":"A","text":"string"},{"id":"B","text":"string"},{"id":"C","text":"string"},{"id":"D","text":"string"}],"correctAnswer":{"id":"A"},"hintBn":"string","explanationBn":"string","difficulty":"easy","conceptTag":"string"}],"closingSummaryBn":"string"}`)
    return parseQuizJson(result.response.text(), topicTitle)
  } catch {
    return fallbackQuestions(topicTitle)
  }
}
