import { chatWithOllama, OLLAMA_DEFAULTS } from '@/lib/ai/ollama'
import { searchOfflineCurriculum, type OfflineSearchResult } from '@/lib/offline/offline-curriculum'

export interface OfflineAskInput {
  question: string
  subject?: string
  classLevel?: string
  language?: string
}

export interface OfflineAskResponse {
  answer: string
  provider: 'ollama'
  offline: true
  model: string
  embeddingModel: string
  usedContext: boolean
  sources: Array<{
    conceptKey: string
    title: string
    subject: string
    classLevel: string
  }>
  diagram: string | null
  graphPath: string[]
  grounding: {
    grounded: boolean
    label: string
    sourceDataset: string
    similarity: number | null
  }
  error?: string
}

export function offlineAiEnabled() {
  return (
    process.env.NEXT_PUBLIC_ENABLE_OFFLINE_AI === 'true' &&
    process.env.OFFLINE_AI_PROVIDER === 'ollama'
  )
}

type GeneralConcept = {
  key: string
  title: string
  aliases: string[]
  answer: string
  example: string
  summary: string[]
  followUp: string
}

const GENERAL_CONCEPTS: GeneralConcept[] = [
  {
    key: 'gravity',
    title: 'Gravity',
    aliases: ['gravity', 'gravitation', 'gravitational force', 'মহাকর্ষ', 'অভিকর্ষ', 'মাধ্যাকর্ষণ'],
    answer: 'Gravity বা মাধ্যাকর্ষণ হলো এমন আকর্ষণ বল, যার কারণে ভরযুক্ত বস্তু একে অপরকে টানে। পৃথিবীর gravity আমাদের মাটির দিকে টেনে রাখে, তাই জিনিস ছেড়ে দিলে নিচে পড়ে।',
    example: 'গাছ থেকে আম পড়লে সেটি উপরে না গিয়ে মাটিতে পড়ে, কারণ পৃথিবীর gravity আমটিকে নিচের দিকে টানে।',
    summary: ['Gravity একটি আকর্ষণ বল।', 'ভরযুক্ত বস্তু একে অপরকে টানে।', 'পৃথিবীর gravity জিনিসকে মাটির দিকে টানে।'],
    followUp: 'তুমি কি gravity আর weight-এর পার্থক্য জানতে চাও?',
  },
  {
    key: 'photosynthesis-general',
    title: 'Photosynthesis',
    aliases: ['photosynthesis', 'সালোকসংশ্লেষণ', 'salok songshleshon', 'plant food'],
    answer: 'সালোকসংশ্লেষণ হলো প্রক্রিয়া যেখানে সবুজ উদ্ভিদ সূর্যের আলো, পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে এবং অক্সিজেন ছাড়ে।',
    example: 'ধান গাছ মাঠে সূর্যের আলো পেয়ে নিজের খাদ্য তৈরি করে বড় হয়।',
    summary: ['উদ্ভিদ আলো ব্যবহার করে খাদ্য বানায়।', 'পানি ও কার্বন ডাই-অক্সাইড লাগে।', 'অক্সিজেন বাইরে বের হয়।'],
    followUp: 'ক্লোরোফিলের কাজটা জানতে চাও?',
  },
  {
    key: 'evaporation',
    title: 'Evaporation',
    aliases: ['evaporation', 'বাষ্পীভবন', 'bashpibhobon', 'water vapor'],
    answer: 'বাষ্পীভবন হলো তরল পদার্থ ধীরে ধীরে গ্যাসে পরিণত হওয়া। সাধারণত তাপ পেলে পানির অণুগুলো দ্রুত নড়ে এবং কিছু অণু বাষ্প হয়ে বাতাসে চলে যায়।',
    example: 'রোদে ভেজা কাপড় শুকিয়ে যায়, কারণ কাপড়ের পানি বাষ্প হয়ে বাতাসে মিশে যায়।',
    summary: ['তরল থেকে গ্যাসে যাওয়াই বাষ্পীভবন।', 'তাপ পেলে প্রক্রিয়াটি দ্রুত হয়।', 'কাপড় শুকানো এর সহজ উদাহরণ।'],
    followUp: 'বাষ্পীভবন আর স্ফুটনের পার্থক্য জানতে চাও?',
  },
  {
    key: 'electricity',
    title: 'Electricity',
    aliases: ['electricity', 'current', 'বিদ্যুৎ', 'কারেন্ট', 'bidyut'],
    answer: 'বিদ্যুৎ হলো বৈদ্যুতিক আধানের প্রবাহ বা শক্তির একটি রূপ। তারের ভেতর ইলেকট্রন চলাচল করলে আমরা সেটিকে electric current হিসেবে ব্যবহার করি।',
    example: 'বাড়ির ফ্যান ঘোরে কারণ বিদ্যুৎ মোটরে গিয়ে শক্তি দেয়।',
    summary: ['বিদ্যুৎ আধানের প্রবাহের সাথে সম্পর্কিত।', 'ইলেকট্রন চলাচল current তৈরি করে।', 'এটি আলো, ফ্যান, মোবাইল চার্জে কাজে লাগে।'],
    followUp: 'AC আর DC current-এর পার্থক্য জানতে চাও?',
  },
  {
    key: 'sky-blue',
    title: 'Why The Sky Looks Blue',
    aliases: ['why sky blue', 'why is sky blue', 'sky blue', 'আকাশ নীল কেন', 'akash nil keno', 'blue sky'],
    answer: 'আকাশ নীল দেখায় কারণ সূর্যের আলো বাতাসে ঢুকে ছড়িয়ে পড়ে। নীল আলো অন্য অনেক রঙের তুলনায় বেশি ছড়ায়, তাই দিনের বেলায় আমাদের চোখে আকাশ নীল লাগে। এই ঘটনাকে Rayleigh scattering বলা হয়।',
    example: 'বাংলাদেশে পরিষ্কার দিনে মাঠে দাঁড়িয়ে আকাশ দেখলে নীল লাগে, কিন্তু সূর্যাস্তে আলো লম্বা পথ পাড়ি দেয় বলে আকাশ লালচে বা কমলা দেখায়।',
    summary: ['সূর্যের আলোতে অনেক রঙ থাকে।', 'বাতাস নীল আলো বেশি ছড়িয়ে দেয়।', 'তাই পরিষ্কার দিনে আকাশ নীল দেখায়।'],
    followUp: 'সূর্যাস্তের সময় আকাশ লালচে কেন হয়, সেটা জানতে চাও?',
  },
  {
    key: 'rain',
    title: 'Rain',
    aliases: ['rain', 'why rain', 'বৃষ্টি', 'brishti', 'বৃষ্টি কেন হয়'],
    answer: 'বৃষ্টি হয় যখন জলীয় বাষ্প ঠান্ডা হয়ে ছোট ছোট পানির ফোঁটায় পরিণত হয়। মেঘের ভেতর ফোঁটাগুলো বড় ও ভারী হলে সেগুলো মাটির দিকে পড়ে।',
    example: 'গরম দিনে পুকুর-নদীর পানি বাষ্প হয়ে ওপরে যায়, পরে মেঘ তৈরি হয়ে বৃষ্টি নামতে পারে।',
    summary: ['পানি বাষ্প হয়ে ওপরে ওঠে।', 'ঠান্ডা হয়ে মেঘে পানির ফোঁটা তৈরি হয়।', 'ফোঁটা ভারী হলে বৃষ্টি পড়ে।'],
    followUp: 'মেঘ কীভাবে তৈরি হয় জানতে চাও?',
  },
]

function normalizedText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\w\u0980-\u09FF\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findGeneralConcept(question: string) {
  const normalized = normalizedText(question)
  return GENERAL_CONCEPTS.find(concept =>
    concept.aliases.some(alias => {
      const normalizedAlias = normalizedText(alias)
      return normalized === normalizedAlias || normalized.includes(normalizedAlias)
    })
  )
}

function generalConceptAnswer(concept: GeneralConcept) {
  return [
    `ব্যাখ্যা: ${concept.answer}`,
    '',
    `স্থানীয় উদাহরণ: ${concept.example}`,
    '',
    ...concept.summary.slice(0, 3).map(item => `- ${item}`),
    '',
    `Follow-up: ${concept.followUp}`,
  ].join('\n')
}

function contextText(results: OfflineSearchResult[]) {
  if (!results.length) return 'No matching offline curriculum context.'
  return results.map((result, index) => {
    const chunk = result.chunk
    return `${index + 1}. ${chunk.title} (${chunk.subject} class ${chunk.classLevel})
${chunk.content}
Examples: ${chunk.examples.join(', ')}
Keywords: ${chunk.keywords.join(', ')}`
  }).join('\n\n')
}

function fallbackAnswer(input: OfflineAskInput, results: OfflineSearchResult[]) {
  const best = results[0]?.chunk
  if (!best) {
    return [
      'ব্যাখ্যা: এই প্রশ্নের জন্য offline general AI এখন উত্তর দিতে পারছে না। Ollama চালু আছে কিনা দেখে আবার চেষ্টা করো।',
      '',
      'স্থানীয় উদাহরণ: গ্রামের লাইব্রেরিতে বই না পেলে যেমন শিক্ষককে জিজ্ঞেস করতে হয়, এখানে local model চালু থাকা দরকার।',
      '',
      '- Offline pack-এ exact context নেই।',
      '- General answer দিতে Ollama model দরকার।',
      '- Internet এলে full AI explanation পাওয়া যাবে।',
      '',
      `Follow-up: "${input.question}" প্রশ্নটা আরেকটু নির্দিষ্ট করে লিখবে?`,
    ].join('\n')
  }

  return [
    `ব্যাখ্যা: ${best.content}`,
    '',
    `স্থানীয় উদাহরণ: ${best.examples[0] || 'বাংলাদেশের দৈনন্দিন জীবনের একটি ঘটনা'} দিয়ে এই ধারণা বোঝা যায়।`,
    '',
    `- মূল ধারণা: ${best.title}`,
    `- গুরুত্বপূর্ণ শব্দ: ${best.keywords.slice(0, 3).join(', ')}`,
    '- উত্তরটি offline lightweight model/pack থেকে সংক্ষিপ্ত রাখা হয়েছে।',
    '',
    `Follow-up: ${best.title} বুঝতে কোন অংশটা সবচেয়ে কঠিন লাগছে?`,
  ].filter(Boolean).join('\n')
}

function buildPrompt(input: OfflineAskInput, results: OfflineSearchResult[], generalConcept?: GeneralConcept) {
  const hint = generalConcept
    ? `Likely concept: ${generalConcept.title}. Explain this concept clearly and do not switch to another topic.`
    : 'First identify the likely concept from the student question, then answer in simple Bangla.'

  if (!results.length) {
    return `You are VoicePandita offline general tutor for Bangladeshi students.
Answer the student's question in Bangla.
If the question is about a common science, maths, or general school concept, provide a concise correct explanation.
If the question is not clearly curriculum-grounded, do not invent curriculum content.
If you are unsure, say so briefly and ask the student to clarify.
Do not mention marks, board exam, model test, or rank.
Do not return code, JSON, or URLs.

Student question:
${input.question}

Return in Bangla:
- a short explanation
- one local example
- 3 bullet summary
- one follow-up question`
  }

  return `You are VoicePandita offline curriculum tutor.
Use simple Bangla.
Answer the student's question clearly and briefly.
Use only the provided curriculum context to ground the answer.
Do not invent unrelated science concepts.
Do not mention marks, board exam, model test, or rank.
Do not return code, JSON, or URLs.

Curriculum context:
${contextText(results)}

Student question:
${input.question}

Return in Bangla:
- explanation
- local example
- 3 bullet summary
- one follow-up question`
}

function isAcceptableOfflineAnswer(answer: string, options: { requireBangla?: boolean; allowGeneralFallback?: boolean } = {}) {
  const text = answer.trim()
  if (text.length < 40) return false
  if (/(marks|board exam|model test|rank|পরীক্ষায় কত নম্বর)/i.test(text)) return false
  if (/(http|```json|\{|\})/i.test(text)) return false
  if (/(i think|maybe|not sure|probably|guess|সম্ভবত|মনে হয়|শেখার অভাব)/i.test(text)) return false

  const bengaliChars = Array.from(text.matchAll(/[\u0980-\u09FF]/g)).length
  const letters = Array.from(text.matchAll(/[A-Za-z\u0980-\u09FF]/g)).length
  if (letters === 0) return false

  if (options.requireBangla === false) return true
  const ratio = bengaliChars / letters
  if (ratio < 0.25) return false
  if (options.allowGeneralFallback) return ratio >= 0.15

  return ratio >= 0.35
}

function simpleDiagram(results: OfflineSearchResult[]) {
  const title = results[0]?.chunk.title
  if (!title) return null
  return `graph LR
  A[${title}] --> B[মূল ধারণা]
  A --> C[বাংলাদেশি উদাহরণ]
  B --> D[ছোট ব্যাখ্যা]
  C --> D`
}

export async function runOfflineAsk(input: OfflineAskInput): Promise<OfflineAskResponse> {
  const subject = input.subject || 'Physics'
  const classLevel = input.classLevel || '9'
  const results = await searchOfflineCurriculum(input.question, subject, classLevel)
  const generalConcept = results.length ? undefined : findGeneralConcept(input.question)
  const prompt = buildPrompt(input, results, generalConcept)

  const model = process.env.OLLAMA_MODEL?.trim() || OLLAMA_DEFAULTS.model
  const embeddingModel = process.env.OLLAMA_EMBED_MODEL?.trim() || OLLAMA_DEFAULTS.embeddingModel
  let answer: string
  let error: string | undefined

  if (generalConcept) {
    answer = generalConceptAnswer(generalConcept)
  } else {
    try {
      const generated = await chatWithOllama(
        [
          { role: 'system', content: 'You are a concise Bangla offline tutor for Bangladeshi learners.' },
          { role: 'user', content: prompt },
        ],
        { model, timeoutMs: 45000, maxTokens: 260, temperature: 0.15 }
      )

      const allowGeneralFallback = results.length === 0
      answer = isAcceptableOfflineAnswer(generated.content, {
        requireBangla: results.length > 0,
        allowGeneralFallback,
      })
        ? generated.content
        : fallbackAnswer(input, results)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      answer = fallbackAnswer(input, results)
    }
  }

  return {
    answer,
    provider: 'ollama',
    offline: true,
    model,
    embeddingModel,
    usedContext: results.length > 0,
    sources: results.map(result => ({
      conceptKey: result.chunk.conceptKey,
      title: result.chunk.title,
      subject: result.chunk.subject,
      classLevel: result.chunk.classLevel,
    })),
    diagram: simpleDiagram(results),
    graphPath: results[0]
      ? ['Offline Curriculum', results[0].chunk.subject, results[0].chunk.title]
      : ['Offline General AI', subject, generalConcept?.title || 'No curriculum pack match'],
    grounding: {
      grounded: results.length > 0,
      label: results.length > 0 ? 'Offline Ollama curriculum pack' : 'Offline general answer',
      sourceDataset: 'public/offline-packs',
      similarity: results[0]?.score ?? null,
    },
    error,
  }
}
