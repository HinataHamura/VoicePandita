import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation'
type EmotionState = 'confident' | 'confused' | 'frustrated'

const geminiKey = process.env.GEMINI_API_KEY
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null

const CURRICULUM: Record<string, { title: string; facts: string[]; diagram: string }> = {
  physics: {
    title: 'পদার্থবিজ্ঞান',
    facts: [
      'নিউটনের দ্বিতীয় সূত্র বলে, কোনো বস্তুর উপর বল প্রয়োগ করলে তার ত্বরণ তৈরি হয়। সূত্র: F = ma।',
      'বল যত বেশি হবে, একই ভরের বস্তুর ত্বরণ তত বেশি হবে। ভর বেশি হলে একই বলেও ত্বরণ কম হয়।',
      'বাস্তব উদাহরণ: খালি ঠেলাগাড়ি ঠেলতে কম বল লাগে, কিন্তু বোঝাই ঠেলাগাড়ি ঠেলতে বেশি বল লাগে।',
    ],
    diagram: 'graph LR\n  A[বল F] --> B[ভর m]\n  A --> C[ত্বরণ a]\n  B --> D[F = ma]\n  C --> D',
  },
  chemistry: {
    title: 'রসায়ন',
    facts: [
      'আয়নিক বন্ধনে একটি পরমাণু ইলেকট্রন ছেড়ে দেয় এবং অন্য পরমাণু সেটি গ্রহণ করে।',
      'ইলেকট্রন হারালে ধনাত্মক আয়ন, আর ইলেকট্রন গ্রহণ করলে ঋণাত্মক আয়ন তৈরি হয়।',
      'বিপরীত আধানের আকর্ষণেই আয়নিক বন্ধন তৈরি হয়।',
    ],
    diagram: 'graph LR\n  A[ধাতু] --> B[ইলেকট্রন ছাড়ে]\n  C[অধাতু] --> D[ইলেকট্রন নেয়]\n  B --> E[আয়নিক বন্ধন]\n  D --> E',
  },
  biology: {
    title: 'জীববিজ্ঞান',
    facts: [
      'সালোকসংশ্লেষণে সবুজ উদ্ভিদ সূর্যের আলো ব্যবহার করে খাদ্য তৈরি করে।',
      'প্রয়োজন হয় কার্বন ডাই-অক্সাইড, পানি, ক্লোরোফিল এবং আলো।',
      'ফলাফল হিসেবে গ্লুকোজ ও অক্সিজেন তৈরি হয়।',
    ],
    diagram: 'graph LR\n  A[আলো] --> D[সালোকসংশ্লেষণ]\n  B[CO2] --> D\n  C[পানি] --> D\n  D --> E[গ্লুকোজ]\n  D --> F[অক্সিজেন]',
  },
  math: {
    title: 'গণিত',
    facts: [
      'দ্বিঘাত সমীকরণের সাধারণ রূপ ax² + bx + c = 0।',
      'সমাধানের সূত্র: x = (-b ± √(b² - 4ac)) / 2a।',
      'প্রথমে a, b, c আলাদা করো, তারপর সূত্রে বসাও।',
    ],
    diagram: 'graph LR\n  A[সমীকরণ] --> B[a b c নির্ণয়]\n  B --> C[সূত্রে বসানো]\n  C --> D[দুটি মান]',
  },
  english: {
    title: 'English',
    facts: [
      'Good English practice starts with short, correct sentences.',
      'Read the question, find the main verb, then answer in one clear line first.',
      'For speaking, slow pronunciation and daily repetition matter more than memorizing rules.',
    ],
    diagram: 'graph LR\n  A[Idea] --> B[Simple sentence]\n  B --> C[Practice aloud]\n  C --> D[Confidence]',
  },
  bangla: {
    title: 'বাংলা',
    facts: [
      'বাংলা উত্তরে আগে মূল ভাব লেখো, তারপর উদাহরণ দাও।',
      'বোর্ড পরীক্ষায় সংজ্ঞা, ব্যাখ্যা ও প্রয়োগ আলাদা করে লিখলে নম্বর বাড়ে।',
      'সুন্দর ভাষার চেয়ে পরিষ্কার ভাব বেশি গুরুত্বপূর্ণ।',
    ],
    diagram: 'graph LR\n  A[মূল ভাব] --> B[ব্যাখ্যা]\n  B --> C[উদাহরণ]\n  C --> D[পরীক্ষার উত্তর]',
  },
}

const LOCAL_LESSONS = [
  {
    subject: 'physics',
    keywords: ['newton', '2nd law', 'second law', 'f=ma', 'force', 'বল', 'ত্বরণ'],
    facts: [
      'নিউটনের দ্বিতীয় সূত্র বলে: বল = ভর × ত্বরণ, অর্থাৎ F = ma।',
      'একই ভরের বস্তুতে বেশি বল দিলে ত্বরণ বেশি হয়। কিন্তু ভর বেশি হলে একই বলেও ত্বরণ কম হয়।',
      'সহজ উদাহরণ: খালি কার্ট ঠেলতে কম বল লাগে, ভর্তি কার্ট ঠেলতে বেশি বল লাগে।',
    ],
    diagram: 'graph LR\n  A[বল বাড়ে] --> B[ত্বরণ বাড়ে]\n  C[ভর বাড়ে] --> D[ত্বরণ কমে]\n  B --> E[F = ma]\n  D --> E',
  },
  {
    subject: 'physics',
    keywords: ['ohm', 'ওহম', 'voltage', 'current', 'resistance', 'বিদ্যুৎ', 'কারেন্ট'],
    facts: [
      'ওহমের সূত্র: V = IR। এখানে V হলো ভোল্টেজ, I হলো কারেন্ট, R হলো রেজিস্ট্যান্স।',
      'ভোল্টেজ বেশি হলে একই রেজিস্ট্যান্সে কারেন্ট বেশি যায়। রেজিস্ট্যান্স বেশি হলে কারেন্ট কমে।',
      'পানির পাইপ ভাবো: চাপ হলো ভোল্টেজ, পানির প্রবাহ হলো কারেন্ট, সরু পাইপ হলো রেজিস্ট্যান্স।',
    ],
    diagram: 'graph LR\n  A[Voltage V] --> B[Current I]\n  C[Resistance R] -->|বাধা| B\n  B --> D[V = IR]',
  },
  {
    subject: 'biology',
    keywords: ['photosynthesis', 'সালোক', 'উদ্ভিদ', 'chlorophyll', 'co2', 'oxygen'],
    facts: [
      'সালোকসংশ্লেষণে উদ্ভিদ সূর্যের আলো ব্যবহার করে নিজের খাদ্য তৈরি করে।',
      'প্রয়োজন হয় আলো, পানি, কার্বন ডাই-অক্সাইড এবং ক্লোরোফিল।',
      'ফল হিসেবে গ্লুকোজ ও অক্সিজেন তৈরি হয়।',
    ],
    diagram: 'graph LR\n  A[আলো] --> D[সালোকসংশ্লেষণ]\n  B[CO2] --> D\n  C[পানি] --> D\n  D --> E[খাদ্য]\n  D --> F[O2]',
  },
  {
    subject: 'chemistry',
    keywords: ['ionic', 'আয়নিক', 'bond', 'বন্ধন', 'electron', 'ইলেকট্রন'],
    facts: [
      'আয়নিক বন্ধনে এক পরমাণু ইলেকট্রন ছেড়ে দেয়, আর অন্য পরমাণু সেটি গ্রহণ করে।',
      'ইলেকট্রন হারানো পরমাণু ধনাত্মক আয়ন, আর গ্রহণ করা পরমাণু ঋণাত্মক আয়ন হয়।',
      'বিপরীত আধানের আকর্ষণেই বন্ধন তৈরি হয়।',
    ],
    diagram: 'graph LR\n  A[ধাতু] --> B[ইলেকট্রন ছাড়ে]\n  C[অধাতু] --> D[ইলেকট্রন নেয়]\n  B --> E[আকর্ষণ]\n  D --> E',
  },
  {
    subject: 'math',
    keywords: ['quadratic', 'দ্বিঘাত', 'equation', 'সমীকরণ', 'x²', 'formula'],
    facts: [
      'দ্বিঘাত সমীকরণের রূপ ax² + bx + c = 0।',
      'সমাধানের সূত্র: x = (-b ± √(b² - 4ac)) / 2a।',
      'আগে a, b, c চিহ্নিত করো, তারপর ধাপে ধাপে সূত্রে বসাও।',
    ],
    diagram: 'graph LR\n  A[ax²+bx+c=0] --> B[a,b,c বের করো]\n  B --> C[সূত্রে বসাও]\n  C --> D[x এর মান]',
  },
  {
    subject: 'english',
    keywords: ['english', 'grammar', 'sentence', 'speaking', 'vocabulary', 'ইংরেজি'],
    facts: [
      'ইংরেজি শেখার শুরু হলো ছোট, পরিষ্কার sentence বানানো।',
      'প্রথমে subject, তারপর verb, তারপর object বসাও: I read physics.',
      'প্রতিদিন ৫টি sentence জোরে বললে speaking confidence বাড়ে।',
    ],
    diagram: 'graph LR\n  A[Subject] --> B[Verb]\n  B --> C[Object]\n  C --> D[Clear sentence]',
  },
]

function normalizeSubject(subject: string) {
  return CURRICULUM[subject] ? subject : 'physics'
}

function selectLesson(question: string, subject: string) {
  const lc = question.toLowerCase()
  const direct = LOCAL_LESSONS.find(lesson => lesson.keywords.some(keyword => lc.includes(keyword.toLowerCase())))
  if (direct) return direct
  const sameSubject = LOCAL_LESSONS.find(lesson => lesson.subject === subject)
  if (sameSubject) return sameSubject
  const base = CURRICULUM[normalizeSubject(subject)]
  return { subject, keywords: [], facts: base.facts, diagram: base.diagram }
}

function detectEmotion(text: string): EmotionState {
  const lc = text.toLowerCase()
  const frustrated = ['পারছি না', 'কঠিন', 'মাথায় ঢুকছে না', 'বারবার', 'হতাশ', 'frustrated', 'too hard', 'parchi na', 'hard']
  const confused = ['বুঝি না', 'বুঝলাম না', 'কেন', 'কীভাবে', 'কি ভাবে', 'confuse', 'how', 'why', 'bujhi na', 'bujhina', 'bujhai', 'bujhao', 'ki bhabe', 'kibhabe']
  if (frustrated.some(w => lc.includes(w))) return 'frustrated'
  if (confused.some(w => lc.includes(w))) return 'confused'
  return 'confident'
}

function fallbackAnswer(question: string, subject: string, outputMode: OutputMode, emotion: EmotionState, language?: string) {
  const item = CURRICULUM[normalizeSubject(subject)]
  const lesson = selectLesson(question, subject)
  const intro =
    emotion === 'frustrated'
      ? 'চিন্তা করো না, একদম ছোট করে ধরছি।'
      : emotion === 'confused'
        ? 'সহজ উদাহরণ দিয়ে শুরু করি।'
        : 'ভালো প্রশ্ন।'

  if (language === 'ckm' || language === 'mrm' || language === 'gnk') {
    return `${intro} ${item.title} বিষয়টি আগে বাংলায় নিরাপদভাবে বুঝি, তারপর মাতৃভাষা সাপোর্টে ব্যবহার করো। ${lesson.facts.join(' ')} ভাবো, তোমার এলাকার নদীর স্রোতের মতো কারণ থেকে ফল তৈরি হচ্ছে। এখন বলো, কোন অংশটা আবার বুঝিয়ে দেব?`
  }

  if (outputMode === 'exam') {
    return `সংজ্ঞা: ${lesson.facts[0]}\n\nব্যাখ্যা: ${lesson.facts[1]}\n\nউদাহরণ: ${lesson.facts[2]}\n\nশেষ প্রশ্ন: এই ধারণাটি কোন বাস্তব ঘটনায় দেখতে পাও?`
  }

  if (outputMode === 'simple') {
    return `${intro} ${lesson.facts[2]} তাই মূল কথা হলো: ${lesson.facts[0]} এবার তুমি নিজের ভাষায় এক লাইনে বলবে?`
  }

  return `${intro} ${lesson.facts.join(' ')} এখন ছোট্ট প্রশ্ন: এই ধারণার কারণ আর ফল কোন দুটি?`
}

function outputInstruction(outputMode: OutputMode) {
  if (outputMode === 'exam') return 'Format as SSC/HSC board exam answer with definition, explanation, example, and one follow-up question.'
  if (outputMode === 'simple') return 'Use the simplest possible Bangla, with a real-life example first.'
  if (outputMode === 'animation') return 'Explain as a short visual sequence. Mention what changes step by step.'
  return 'Give a step-by-step Bangla explanation and end with one Socratic question.'
}

function cleanDiagram(raw: string | null, subject: string) {
  if (!raw) return CURRICULUM[normalizeSubject(subject)].diagram
  const stripped = raw.replace(/```mermaid|```/g, '').trim()
  return stripped.startsWith('graph') || stripped.startsWith('flowchart')
    ? stripped
    : CURRICULUM[normalizeSubject(subject)].diagram
}

async function geminiText(prompt: string) {
  if (!genAI) return null
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const model = genAI.getGenerativeModel({ model: modelName })
  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const question = String(body.question || '').trim()
    const subject = normalizeSubject(String(body.subject || 'physics'))
    const outputMode = String(body.outputMode || 'whiteboard') as OutputMode
    const language = String(body.language || 'bn')
    const detectedEmotion = detectEmotion(question)
    const emotion = (body.emotion || detectedEmotion) as EmotionState

    if (!question) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 })
    }

    const context = CURRICULUM[subject].facts.join('\n')
    const lesson = selectLesson(question, subject)
    const fallback = fallbackAnswer(question, subject, outputMode, emotion, language)
    let answer = fallback
    let diagram = lesson.diagram

    try {
      const prompt = `You are VoicePandita, a student-only Bangla AI tutor for Bangladesh.
Use only the curriculum context below. Do not hallucinate.
Max 120 Bangla words unless exam mode needs structure.
Emotion: ${emotion}
Language preference: ${language}
Output mode: ${outputMode}
Instruction: ${outputInstruction(outputMode)}
If emotion is confused, start with an analogy. If frustrated, be brief and encouraging.

Curriculum context:
${context}

Most relevant local lesson:
${lesson.facts.join('\n')}

Student question:
${question}

Answer in Bangla.`

      const generated = await geminiText(prompt)
      if (generated) answer = generated

      if (outputMode === 'whiteboard' || outputMode === 'animation' || outputMode === 'text') {
        const diagramPrompt = `Create only a valid Mermaid flowchart for this Bangla lesson. No backticks, no explanation.
Use graph LR. Keep 4-6 nodes. Bengali labels are allowed.
Question: ${question}
Context: ${context}`
        diagram = cleanDiagram(await geminiText(diagramPrompt), subject)
      }
    } catch {
      console.warn('/api/ask Gemini unavailable; curriculum fallback used')
    }

    return NextResponse.json({
      answer,
      diagram: outputMode === 'simple' || outputMode === 'exam' ? null : diagram,
      detectedEmotion,
      pwnMessage: 'তুমি একা নও - অনেক শিক্ষার্থী এই ধারণায় আটকে যায়।',
      source: genAI ? 'gemini-with-curriculum-fallback' : 'curriculum-fallback',
    })
  } catch (err) {
    console.error('/api/ask error:', err)
    return NextResponse.json(
      { answer: 'দুঃখিত, এখন উত্তর তৈরি করা যাচ্ছে না। আবার চেষ্টা করো।', diagram: null },
      { status: 500 }
    )
  }
}
