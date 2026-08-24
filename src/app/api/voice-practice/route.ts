import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Types ────────────────────────────────────────────────────────────────────
type PracticeTurn = {
  question: string
  expectedAnswer?: string
  score?: number
  studentAnswer?: string
}

// ─── Question type pool — rotated per attempt so every question is different ──
const QUESTION_TYPES = [
  {
    key: 'definition',
    bangla: 'সংজ্ঞা দাও',
    template: (topic: string) => `${topic} কী? সহজ ভাষায় সংজ্ঞা দাও।`,
    hint: 'Ask for a clear definition in the student\'s own words.',
  },
  {
    key: 'explain-cause',
    bangla: 'কারণ ব্যাখ্যা করো',
    template: (topic: string) => `${topic} কেন ঘটে বা কীভাবে কাজ করে — ব্যাখ্যা করো।`,
    hint: 'Ask why/how it happens. Expect a cause-effect or mechanism answer.',
  },
  {
    key: 'real-example',
    bangla: 'বাস্তব উদাহরণ দাও',
    template: (topic: string) => `${topic} এর দুটি বাস্তব জীবনের উদাহরণ দাও।`,
    hint: 'Ask for 2 real-life examples. Penalize vague/textbook-only answers.',
  },
  {
    key: 'compare',
    bangla: 'তুলনা করো',
    template: (topic: string) => `${topic} এর সাথে একটি সম্পর্কিত ধারণার পার্থক্য বলো।`,
    hint: 'Ask for a comparison. Award marks for naming both sides clearly.',
  },
  {
    key: 'apply',
    bangla: 'প্রয়োগ করো',
    template: (topic: string) => `${topic} ব্যবহার করে একটি সমস্যা সমাধান করো বা প্রয়োগ দেখাও।`,
    hint: 'Give a scenario or numeric problem. Expect step-by-step application.',
  },
  {
    key: 'importance',
    bangla: 'গুরুত্ব বলো',
    template: (topic: string) => `${topic} কেন গুরুত্বপূর্ণ? তিনটি কারণ বলো।`,
    hint: 'Award marks for each valid reason. Penalize repetition.',
  },
  {
    key: 'derive-formula',
    bangla: 'সূত্র বের করো',
    template: (topic: string) => `${topic} এর সূত্রটি ধাপে ধাপে বের করো অথবা ব্যাখ্যা করো।`,
    hint: 'Expect logical steps. Award partial marks for each correct step.',
  },
  {
    key: 'true-false-reason',
    bangla: 'সত্য/মিথ্যা যাচাই',
    template: (topic: string) => `${topic} সম্পর্কে একটি সাধারণ ভুল ধারণা আছে — সেটি ঠিক না ভুল, কারণসহ বলো।`,
    hint: 'State a common misconception and ask the student to evaluate it.',
  },
]

// ─── Gemini setup ─────────────────────────────────────────────────────────────
const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  return JSON.parse(match ? match[0] : cleaned)
}

async function generateText(prompt: string): Promise<string | null> {
  if (!genAI) return null
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// ─── Fallbacks (used when Gemini is unavailable or fails) ─────────────────────
function fallbackQuestion(topic: string, history: PracticeTurn[]) {
  const idx = history.length % QUESTION_TYPES.length
  const qt = QUESTION_TYPES[idx]
  return {
    question: qt.template(topic),
    expectedAnswer: `${topic} সম্পর্কে সঠিক সংজ্ঞা, কারণ এবং একটি উদাহরণসহ উত্তর দিলে ভালো হবে।`,
    difficulty: history.length < 3 ? 'easy' : history.length < 6 ? 'medium' : 'hard',
    questionType: qt.key,
  }
}

function fallbackGrade(answer: string, expectedAnswer: string, topic: string) {
  const words = answer.toLowerCase().split(/\s+/).filter(Boolean)
  const expected = expectedAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const overlap = expected.filter(w => answer.toLowerCase().includes(w)).length
  const lengthScore = Math.min(35, words.length * 3)
  const overlapScore = Math.min(45, overlap * 9)
  const score = Math.max(18, Math.min(88, lengthScore + overlapScore + 12))
  return {
    score,
    verdict: score >= 75 ? 'ভালো উত্তর' : score >= 50 ? 'আংশিক সঠিক' : 'আরো পড়তে হবে',
    feedback:
      score >= 75
        ? `ভালো! ${topic} এর মূল ধারণা ধরতে পেরেছো।`
        : `${topic} এর সংজ্ঞা এবং উদাহরণ আরো স্পষ্ট করলে ভালো হতো।`,
    missingPoints: score >= 75 ? [] : ['স্পষ্ট সংজ্ঞা', 'একটি উদাহরণ', 'কেন গুরুত্বপূর্ণ'],
    modelAnswer: expectedAnswer,
    nextStep:
      score >= 75
        ? 'পরের প্রশ্নে আরো গভীর ধারণা দেখাও।'
        : 'Model answer পড়ো, তারপর আবার চেষ্টা করো।',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = String(body.action || '')
    const topic = String(body.topic || '').trim()
    const subject = String(body.subject || 'general').trim()

    // Take the last 8 turns for context, but pass full count for rotation
    const rawHistory: PracticeTurn[] = Array.isArray(body.history)
      ? (body.history as PracticeTurn[])
      : []
    const history = rawHistory.slice(-8)
    const totalAttempts = rawHistory.length  // used for question-type rotation

    if (!topic) {
      return NextResponse.json({ error: 'Topic required' }, { status: 400 })
    }

    // ── QUESTION generation ────────────────────────────────────────────────────
    if (action === 'question') {
      // Rotate question type based on total attempt count so it never repeats
      const qtIndex = totalAttempts % QUESTION_TYPES.length
      const qt = QUESTION_TYPES[qtIndex]

      const fallback = fallbackQuestion(topic, rawHistory)
      if (!genAI) return NextResponse.json({ ...fallback, source: 'fallback' })

      const historyText = history.length
        ? history
            .map(
              (item, i) =>
                `${i + 1}. প্রশ্ন: ${item.question}\n   উত্তর: ${item.studentAnswer || 'উত্তর দেয়নি'}\n   স্কোর: ${item.score ?? 'n/a'}`,
            )
            .join('\n')
        : 'এখনো কোনো প্রশ্নের উত্তর দেওয়া হয়নি।'

      const avgScore =
        history.filter(h => h.score != null).length > 0
          ? Math.round(
              history.filter(h => h.score != null).reduce((s, h) => s + (h.score ?? 0), 0) /
                history.filter(h => h.score != null).length,
            )
          : null

      const difficulty =
        avgScore == null ? 'easy' : avgScore >= 75 ? 'hard' : avgScore >= 50 ? 'medium' : 'easy'

      const prompt = `তুমি VoicePandita — বাংলাদেশের SSC/HSC পরীক্ষার্থীদের জন্য একজন মেধাবী শিক্ষক।

বিষয়: ${subject}
টপিক: ${topic}
এই সেশনে মোট প্রচেষ্টা: ${totalAttempts}
বর্তমান প্রশ্নের ধরন (এটি মেনে চলতেই হবে): ${qt.key} — "${qt.bangla}"
প্রশ্নের কঠিনত্ব: ${difficulty}

পূর্ববর্তী প্রশ্ন ও উত্তর:
${historyText}

নির্দেশনা:
- প্রশ্নের ধরন হবে EXACTLY "${qt.key}": ${qt.hint}
- প্রশ্নটি হবে সহজ, স্পষ্ট বাংলায় — ছাত্র ৩০-৫০ সেকেন্ডে মুখে উত্তর দিতে পারবে।
- পূর্বের কোনো প্রশ্ন হুবহু পুনরাবৃত্তি করবে না।
- শুধুমাত্র JSON আউটপুট দেবে, অন্য কিছু নয়।

JSON ফরম্যাট:
{
  "question": "প্রশ্নটি এখানে বাংলায়",
  "expectedAnswer": "মানদণ্ড উত্তর — মূল পয়েন্টগুলো বাংলায়",
  "difficulty": "${difficulty}",
  "questionType": "${qt.key}"
}`

      try {
        const text = await generateText(prompt)
        const parsed = text ? safeJson(text) : fallback
        return NextResponse.json({
          question: String(parsed.question || fallback.question),
          expectedAnswer: String(parsed.expectedAnswer || fallback.expectedAnswer),
          difficulty: ['easy', 'medium', 'hard'].includes(String(parsed.difficulty))
            ? parsed.difficulty
            : fallback.difficulty,
          questionType: qt.key,
          source: 'gemini',
        })
      } catch (err) {
        console.warn('/api/voice-practice question fallback:', err instanceof Error ? err.message : err)
        return NextResponse.json({ ...fallback, source: 'fallback' })
      }
    }

    // ── GRADE answer ──────────────────────────────────────────────────────────
    if (action === 'grade') {
      const question = String(body.question || '').trim()
      const expectedAnswer = String(body.expectedAnswer || '').trim()
      const studentAnswer = String(body.studentAnswer || '').trim()
      const questionType = String(body.questionType || 'definition')

      if (!question || !studentAnswer) {
        return NextResponse.json({ error: 'Question and answer required' }, { status: 400 })
      }

      const fallback = fallbackGrade(studentAnswer, expectedAnswer || topic, topic)
      if (!genAI) return NextResponse.json({ ...fallback, source: 'fallback' })

      const gradingGuide: Record<string, string> = {
        definition:
          'সংজ্ঞায় মূল ধারণা থাকলে ৪০ নম্বর, উদাহরণ থাকলে +২০, নিজের ভাষায় বললে +১০।',
        'explain-cause':
          'কারণ-প্রভাব সম্পর্ক স্পষ্ট থাকলে ৫০ নম্বর, ধাপ সঠিক থাকলে +২০।',
        'real-example':
          'প্রতিটি সঠিক উদাহরণে ৩০ নম্বর করে, মোট ৬০; কারণ ব্যাখ্যা করলে +২০।',
        compare:
          'দুটো দিক স্পষ্টভাবে বললে ৫০ নম্বর, নির্দিষ্ট পার্থক্য প্রতিটিতে +১৫।',
        apply:
          'সঠিক পদ্ধতি ব্যবহার করলে ৪০, সঠিক উত্তর পেলে +৩০, একক ঠিক থাকলে +১০।',
        importance:
          'প্রতিটি বৈধ কারণে ২৫ নম্বর (৩টিতে ৭৫ পর্যন্ত), পুনরাবৃত্তি করলে বাদ।',
        'derive-formula':
          'প্রতিটি সঠিক ধাপে ২০ নম্বর, চূড়ান্ত সূত্র সঠিক হলে +২০।',
        'true-false-reason':
          'সঠিক সিদ্ধান্তে ৩০ নম্বর, কারণ স্পষ্ট হলে +৪০, উদাহরণ দিলে +২০।',
      }

      const prompt = `তুমি VoicePandita — একজন সহানুভূতিশীল কিন্তু সঠিক মূল্যায়নকারী শিক্ষক।

বিষয়: ${subject}
টপিক: ${topic}
প্রশ্নের ধরন: ${questionType}
প্রশ্ন: ${question}
প্রত্যাশিত উত্তর: ${expectedAnswer || 'বিষয়ভিত্তিক সঠিক স্তরের উত্তর ধরো।'}
ছাত্রের মুখের উত্তর: ${studentAnswer}

নম্বর দেওয়ার নির্দেশনা (${questionType} ধরনের জন্য):
${gradingGuide[questionType] || 'মূল ধারণা সঠিক থাকলে ৫০+, উদাহরণ থাকলে +২০।'}

সাধারণ নিয়ম:
- সঠিক ধারণা নিজের ভাষায় বললে পূর্ণ নম্বর দাও।
- আঞ্চলিক বাংলা, ভুল উচ্চারণ বা সংক্ষিপ্ত বাক্যে নম্বর কাটবে না।
- ভুল তথ্য বা ভুল ধারণায় কড়া নম্বর কাটো।
- উত্তর ফাঁকা বা সম্পূর্ণ অপ্রাসঙ্গিক হলে ৩৫ এর নিচে।

শুধুমাত্র JSON দেবে:
{
  "score": 0-100,
  "verdict": "এক লাইনে মূল্যায়ন বাংলায়",
  "feedback": "২-৩ বাক্যে উৎসাহমূলক কিন্তু সৎ মন্তব্য বাংলায়",
  "missingPoints": ["বাদ পড়া পয়েন্ট ১", "বাদ পড়া পয়েন্ট ২"],
  "modelAnswer": "সহজ বাংলায় আদর্শ উত্তর",
  "nextStep": "একটি নির্দিষ্ট পরবর্তী পদক্ষেপ"
}`

      try {
        const text = await generateText(prompt)
        const parsed = text ? safeJson(text) : fallback
        return NextResponse.json({
          score: Math.max(0, Math.min(100, Number(parsed.score ?? fallback.score))),
          verdict: String(parsed.verdict || fallback.verdict),
          feedback: String(parsed.feedback || fallback.feedback),
          missingPoints: Array.isArray(parsed.missingPoints)
            ? parsed.missingPoints.map(String).slice(0, 5)
            : fallback.missingPoints,
          modelAnswer: String(parsed.modelAnswer || fallback.modelAnswer),
          nextStep: String(parsed.nextStep || fallback.nextStep),
          source: 'gemini',
        })
      } catch (err) {
        console.warn('/api/voice-practice grade fallback:', err instanceof Error ? err.message : err)
        return NextResponse.json({ ...fallback, source: 'fallback' })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('/api/voice-practice error:', err)
    return NextResponse.json({ error: 'Practice request failed' }, { status: 500 })
  }
}
