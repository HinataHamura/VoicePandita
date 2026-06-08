import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation' | 'video'
type AnimationKey = 'newton_second_law' | 'photosynthesis' | 'minerals' | 'quadratic_formula' | 'generic_concept'
type EmotionState = 'confident' | 'confused' | 'frustrated'

type StudentProfileContext = {
  level?: string
  goal?: string
  group?: string
}

type RetrievedCurriculumChunk = {
  content: string
  contextText?: string
  context_text?: string
  contextual_summary?: string
  subject?: string
  topic: string
  chapter?: string
  chunk_type?: string
  level?: string
  source_dataset?: string
  question_text?: string
  answer_text?: string
  correct_answer?: string
  distractor_answers?: string[] | Record<string, string>
  hints?: string[] | Record<string, string>
  convergence?: unknown
  topic_tags?: string[]
  similarity: number
}

type ChatContextItem = {
  role?: string
  text?: string
  graphPath?: string[]
}

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null
const groqKey = process.env.GROQ_API_KEY?.trim()
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null

function profileInstruction(profile?: StudentProfileContext) {
  const level = String(profile?.level || '').toUpperCase()
  const goal = String(profile?.goal || '')
  const group = String(profile?.group || '')
  const parts = [
    level ? `Level: ${level}` : '',
    goal ? `Goal: ${goal}` : '',
    group ? `Group: ${group}` : '',
  ].filter(Boolean)

  if (!parts.length) return 'Student profile: not set.'
  const style = goal === 'admission'
    ? 'Prioritize concept-first reasoning, shortcuts only after intuition, and common traps.'
    : 'Prioritize board-exam clarity, definition, explanation, example, and marks-friendly wording.'
  return `Student profile: ${parts.join(', ')}. ${style}`
}

function curriculumContextText(chunks?: RetrievedCurriculumChunk[]) {
  if (!Array.isArray(chunks) || chunks.length === 0) return 'None'
  return chunks.slice(0, 6).map((chunk, i) => {
    const contextText = chunk.contextText || chunk.context_text || [chunk.contextual_summary, chunk.content].filter(Boolean).join('\n\n')
    const chunkMeta = [chunk.level?.toUpperCase(), chunk.source_dataset, chunk.subject, chunk.chapter, chunk.topic, chunk.chunk_type].filter(Boolean).join(' / ')
    const score = Number.isFinite(chunk.similarity) ? ` similarity=${chunk.similarity.toFixed(2)}` : ''
    const hints = Array.isArray(chunk.hints) ? chunk.hints.filter(Boolean).slice(0, 5) : []
    const distractors = Array.isArray(chunk.distractor_answers) ? chunk.distractor_answers.filter(Boolean).slice(0, 5) : []
    const extra = [
      chunk.correct_answer ? `Correct answer: ${chunk.correct_answer}` : '',
      hints.length ? `Progressive hints: ${hints.join(' | ')}` : '',
      distractors.length ? `Common distractors/misconceptions: ${distractors.join(' | ')}` : '',
      chunk.topic_tags?.length ? `Topic tags: ${chunk.topic_tags.join(', ')}` : '',
    ].filter(Boolean).join('\n')
    return `${i + 1}. [${chunkMeta || chunk.topic}${score}] ${contextText}${extra ? `\n${extra}` : ''}`
  }).join('\n')
}

function groundingInfo(chunks?: RetrievedCurriculumChunk[], profile?: StudentProfileContext) {
  const valid = Array.isArray(chunks)
    ? chunks
        .filter(chunk => Number(chunk.similarity || 0) >= 0.42)
        .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
    : []
  const best = valid[0]
  if (!best) {
    return { grounded: false, label: null, sourceDataset: null, similarity: null }
  }

  const dataset = best.source_dataset || null
  const level = String(best.level || profile?.level || '').toUpperCase()
  const label = dataset === 'ssc-banglatutor'
    ? 'SSC-BanglaTutor grounded'
    : level
      ? `${level} curriculum grounded`
      : 'Curriculum grounded'

  return {
    grounded: true,
    label,
    sourceDataset: dataset,
    similarity: Number(best.similarity || 0),
  }
}

function chatContextText(items?: ChatContextItem[]) {
  if (!Array.isArray(items) || items.length === 0) return 'None'
  return items.slice(-6).map((item, i) => {
    const role = item.role === 'user' ? 'Student' : 'Tutor'
    const path = Array.isArray(item.graphPath) && item.graphPath.length
      ? ` [topic: ${item.graphPath.join(' -> ')}]`
      : ''
    return `${i + 1}. ${role}${path}: ${String(item.text || '').replace(/\s+/g, ' ').slice(0, 900)}`
  }).join('\n')
}

function looksLikeFollowUp(question: string) {
  return /\b(ei|eta|etar|related|previous|prev|same topic|follow up|follow-up)\b/i.test(question) ||
    /(à¦à¦‡|à¦à¦Ÿà¦¾|à¦à¦Ÿà¦¾à¦°|à¦†à¦—à§‡à¦°|à¦ªà§‚à¦°à§à¦¬à§‡à¦°|à¦“à¦‡|à¦|à¦¸à¦®à§à¦ªà¦°à§à¦•à¦¿à¦¤|à¦°à¦¿à¦²à§‡à¦Ÿà§‡à¦¡|à¦à¦•à¦‡)/.test(question)
}

const LESSONS = {
  newton_second_law: {
    subject: 'physics',
    title: "Newton's Second Law",
    path: ['Physics', 'Force and Motion', "Newton's Laws", 'Second Law', 'Application'],
    keywords: ['newton', 'second law', '2nd law', 'f=ma', 'à¦¬à¦²', 'à¦¤à§à¦¬à¦°à¦£', 'à¦­à¦°'],
    facts: [
      'à¦¨à¦¿à¦‰à¦Ÿà¦¨à§‡à¦° à¦¦à§à¦¬à¦¿à¦¤à§€à¦¯à¦¼ à¦¸à§‚à¦¤à§à¦°: à¦¬à¦² = à¦­à¦° Ã— à¦¤à§à¦¬à¦°à¦£, à¦…à¦°à§à¦¥à¦¾à§Ž F = maà¥¤',
      'à¦à¦•à¦‡ à¦­à¦°à§‡à¦° à¦¬à¦¸à§à¦¤à§à¦° à¦‰à¦ªà¦° à¦¬à§‡à¦¶à¦¿ à¦¬à¦² à¦¦à¦¿à¦²à§‡ à¦¤à§à¦¬à¦°à¦£ à¦¬à§‡à¦¶à¦¿ à¦¹à¦¯à¦¼à¥¤ à¦­à¦° à¦¬à§‡à¦¶à¦¿ à¦¹à¦²à§‡ à¦à¦•à¦‡ à¦¬à¦²à§‡à¦“ à¦¤à§à¦¬à¦°à¦£ à¦•à¦® à¦¹à¦¯à¦¼à¥¤',
      'à¦‰à¦¦à¦¾à¦¹à¦°à¦£: à¦–à¦¾à¦²à¦¿ à¦ à§‡à¦²à¦¾à¦—à¦¾à¦¡à¦¼à¦¿ à¦¸à¦¹à¦œà§‡ à¦šà¦²à§‡, à¦•à¦¿à¦¨à§à¦¤à§ à¦¬à§‹à¦à¦¾à¦‡ à¦ à§‡à¦²à¦¾à¦—à¦¾à¦¡à¦¼à¦¿ à¦ à§‡à¦²à¦¤à§‡ à¦¬à§‡à¦¶à¦¿ à¦¬à¦² à¦²à¦¾à¦—à§‡à¥¤',
    ],
    diagram: 'graph LR\n  A[à¦¬à¦² F] --> B[à¦­à¦° m]\n  A --> C[à¦¤à§à¦¬à¦°à¦£ a]\n  B --> D[F = ma]\n  C --> D\n  D --> E[à¦—à¦¤à¦¿ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨]',
  },
  metallic_bond: {
    subject: 'chemistry',
    title: 'Metallic Bond',
    path: ['Chemistry', 'Chemical Bonding', 'Metallic Bond', 'Sea of Electrons'],
    keywords: ['à¦§à¦¾à¦¤à¦¬', 'metallic', 'metal bond', 'à¦§à¦¾à¦¤à§à¦° à¦¬à¦¨à§à¦§à¦¨', 'à¦®à§à¦•à§à¦¤ à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨', 'electron sea'],
    facts: [
      'à¦§à¦¾à¦¤à¦¬ à¦¬à¦¨à§à¦§à¦¨ à¦¹à¦²à§‹ à¦§à¦¾à¦¤à§ à¦ªà¦°à¦®à¦¾à¦£à§à¦° à¦§à¦¨à¦¾à¦¤à§à¦®à¦• à¦†à¦¯à¦¼à¦¨ à¦à¦¬à¦‚ à¦šà¦¾à¦°à¦ªà¦¾à¦¶à§‡ à¦šà¦²à¦¾à¦šà¦²à¦•à¦¾à¦°à§€ à¦®à§à¦•à§à¦¤ à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨à§‡à¦° à¦†à¦•à¦°à§à¦·à¦£à¥¤',
      'à¦§à¦¾à¦¤à§à¦¤à§‡ à¦¬à¦¾à¦‡à¦°à§‡à¦° à¦¸à§à¦¤à¦°à§‡à¦° à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨à¦—à§à¦²à§‹ à¦à¦•à¦Ÿà¦¿ à¦ªà¦°à¦®à¦¾à¦£à§à¦° à¦¸à¦¾à¦¥à§‡ à¦¶à¦•à§à¦¤à¦­à¦¾à¦¬à§‡ à¦¬à¦¾à¦à¦§à¦¾ à¦¥à¦¾à¦•à§‡ à¦¨à¦¾; à¦¤à¦¾à¦°à¦¾ à¦…à¦¨à§‡à¦• à¦†à¦¯à¦¼à¦¨à§‡à¦° à¦šà¦¾à¦°à¦ªà¦¾à¦¶à§‡ à¦›à¦¡à¦¼à¦¿à¦¯à¦¼à§‡ à¦¥à¦¾à¦•à§‡à¥¤',
      'à¦à¦‡ à¦®à§à¦•à§à¦¤ à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨à§‡à¦° à¦œà¦¨à§à¦¯ à¦§à¦¾à¦¤à§ à¦¬à¦¿à¦¦à§à¦¯à§à§Ž à¦ªà¦°à¦¿à¦¬à¦¹à¦¨ à¦•à¦°à§‡, à¦¨à¦®à¦¨à§€à¦¯à¦¼ à¦¹à¦¯à¦¼ à¦à¦¬à¦‚ à¦šà¦•à¦šà¦•à§‡ à¦¦à§‡à¦–à¦¾à¦¯à¦¼à¥¤',
    ],
    diagram: 'graph LR\n  A[à¦§à¦¾à¦¤à§ à¦ªà¦°à¦®à¦¾à¦£à§] --> B[à¦®à§à¦•à§à¦¤ à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨]\n  A --> C[à¦§à¦¨à¦¾à¦¤à§à¦®à¦• à¦§à¦¾à¦¤à¦¬ à¦†à¦¯à¦¼à¦¨]\n  B --> D[à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨à§‡à¦° à¦¸à¦¾à¦—à¦°]\n  C --> E[à¦†à¦•à¦°à§à¦·à¦£]\n  D --> E\n  E --> F[à¦§à¦¾à¦¤à¦¬ à¦¬à¦¨à§à¦§à¦¨]',
  },
  ionic_bond: {
    subject: 'chemistry',
    title: 'Ionic Bond',
    path: ['Chemistry', 'Chemical Bonding', 'Ionic Bond', 'Electron Transfer'],
    keywords: ['à¦†à¦¯à¦¼à¦¨à¦¿à¦•', 'ionic', 'ion', 'electron transfer', 'à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨ à¦—à§à¦°à¦¹à¦£', 'à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨ à¦›à¦¾à§œà§‡'],
    facts: [
      'à¦†à¦¯à¦¼à¦¨à¦¿à¦• à¦¬à¦¨à§à¦§à¦¨à§‡ à¦à¦• à¦ªà¦°à¦®à¦¾à¦£à§ à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨ à¦›à§‡à¦¡à¦¼à§‡ à¦¦à§‡à¦¯à¦¼, à¦†à¦° à¦…à¦¨à§à¦¯ à¦ªà¦°à¦®à¦¾à¦£à§ à¦¸à§‡à¦Ÿà¦¿ à¦—à§à¦°à¦¹à¦£ à¦•à¦°à§‡à¥¤',
      'à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨ à¦¹à¦¾à¦°à¦¾à¦²à§‡ à¦§à¦¨à¦¾à¦¤à§à¦®à¦• à¦†à¦¯à¦¼à¦¨, à¦†à¦° à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨ à¦—à§à¦°à¦¹à¦£ à¦•à¦°à¦²à§‡ à¦‹à¦£à¦¾à¦¤à§à¦®à¦• à¦†à¦¯à¦¼à¦¨ à¦¤à§ˆà¦°à¦¿ à¦¹à¦¯à¦¼à¥¤',
      'à¦¬à¦¿à¦ªà¦°à§€à¦¤ à¦†à¦§à¦¾à¦¨à§‡à¦° à¦†à¦•à¦°à§à¦·à¦£à¦‡ à¦†à¦¯à¦¼à¦¨à¦¿à¦• à¦¬à¦¨à§à¦§à¦¨à¦•à§‡ à¦§à¦°à§‡ à¦°à¦¾à¦–à§‡à¥¤',
    ],
    diagram: 'graph LR\n  A[à¦§à¦¾à¦¤à§] --> B[à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨ à¦›à¦¾à¦¡à¦¼à§‡]\n  C[à¦…à¦§à¦¾à¦¤à§] --> D[à¦‡à¦²à§‡à¦•à¦Ÿà§à¦°à¦¨ à¦¨à§‡à¦¯à¦¼]\n  B --> E[à¦§à¦¨à¦¾à¦¤à§à¦®à¦• à¦†à¦¯à¦¼à¦¨]\n  D --> F[à¦‹à¦£à¦¾à¦¤à§à¦®à¦• à¦†à¦¯à¦¼à¦¨]\n  E --> G[à¦†à¦¯à¦¼à¦¨à¦¿à¦• à¦¬à¦¨à§à¦§à¦¨]\n  F --> G',
  },
  photosynthesis: {
    subject: 'biology',
    title: 'Photosynthesis',
    path: ['Biology', 'Plant Physiology', 'Photosynthesis', 'Food Production'],
    keywords: ['photosynthesis', 'à¦¸à¦¾à¦²à§‹à¦•', 'à¦‰à¦¦à§à¦­à¦¿à¦¦', 'chlorophyll', 'co2', 'à¦…à¦•à§à¦¸à¦¿à¦œà§‡à¦¨'],
    facts: [
      'à¦¸à¦¾à¦²à§‹à¦•à¦¸à¦‚à¦¶à§à¦²à§‡à¦·à¦£à§‡ à¦¸à¦¬à§à¦œ à¦‰à¦¦à§à¦­à¦¿à¦¦ à¦¸à§‚à¦°à§à¦¯à§‡à¦° à¦†à¦²à§‹ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§‡ à¦–à¦¾à¦¦à§à¦¯ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§‡à¥¤',
      'à¦à¦¤à§‡ à¦²à¦¾à¦—à§‡ à¦†à¦²à§‹, à¦ªà¦¾à¦¨à¦¿, à¦•à¦¾à¦°à§à¦¬à¦¨ à¦¡à¦¾à¦‡-à¦…à¦•à§à¦¸à¦¾à¦‡à¦¡ à¦à¦¬à¦‚ à¦•à§à¦²à§‹à¦°à§‹à¦«à¦¿à¦²à¥¤',
      'à¦«à¦² à¦¹à¦¿à¦¸à§‡à¦¬à§‡ à¦—à§à¦²à§à¦•à§‹à¦œ à¦¤à§ˆà¦°à¦¿ à¦¹à¦¯à¦¼ à¦à¦¬à¦‚ à¦…à¦•à§à¦¸à¦¿à¦œà§‡à¦¨ à¦¬à§‡à¦° à¦¹à¦¯à¦¼à¥¤',
    ],
    diagram: 'graph LR\n  A[à¦†à¦²à§‹] --> D[à¦¸à¦¾à¦²à§‹à¦•à¦¸à¦‚à¦¶à§à¦²à§‡à¦·à¦£]\n  B[CO2] --> D\n  C[à¦ªà¦¾à¦¨à¦¿] --> D\n  D --> E[à¦—à§à¦²à§à¦•à§‹à¦œ]\n  D --> F[à¦…à¦•à§à¦¸à¦¿à¦œà§‡à¦¨]',
  },
  quadratic_formula: {
    subject: 'math',
    title: 'Quadratic Formula',
    path: ['Math', 'Algebra', 'Quadratic Equation', 'Formula'],
    keywords: ['quadratic', 'à¦¦à§à¦¬à¦¿à¦˜à¦¾à¦¤', 'à¦¸à¦®à§€à¦•à¦°à¦£', 'formula', 'à¦¸à§‚à¦¤à§à¦°', 'xÂ²'],
    facts: [
      'à¦¦à§à¦¬à¦¿à¦˜à¦¾à¦¤ à¦¸à¦®à§€à¦•à¦°à¦£à§‡à¦° à¦¸à¦¾à¦§à¦¾à¦°à¦£ à¦°à§‚à¦ª axÂ² + bx + c = 0à¥¤',
      'à¦¸à¦®à¦¾à¦§à¦¾à¦¨à§‡à¦° à¦¸à§‚à¦¤à§à¦°: x = (-b Â± âˆš(bÂ² - 4ac)) / 2aà¥¤',
      'à¦ªà§à¦°à¦¥à¦®à§‡ a, b, c à¦†à¦²à¦¾à¦¦à¦¾ à¦•à¦°à§‹, à¦¤à¦¾à¦°à¦ªà¦° à¦¸à§‚à¦¤à§à¦°à§‡ à¦¬à¦¸à¦¿à¦¯à¦¼à§‡ à¦§à¦¾à¦ªà§‡ à¦§à¦¾à¦ªà§‡ à¦¸à¦®à¦¾à¦§à¦¾à¦¨ à¦•à¦°à§‹à¥¤',
    ],
    diagram: 'graph LR\n  A[axÂ²+bx+c=0] --> B[a,b,c à¦¬à§‡à¦° à¦•à¦°à§‹]\n  B --> C[à¦¸à§‚à¦¤à§à¦°à§‡ à¦¬à¦¸à¦¾à¦“]\n  C --> D[x à¦à¦° à¦®à¦¾à¦¨]\n  D --> E[à¦¯à¦¾à¦šà¦¾à¦‡]',
  },
  creative_answer: {
    subject: 'bangla',
    title: 'Creative Answer Structure',
    path: ['Bangla', 'Creative Writing', 'CQ Answer', 'Structure'],
    keywords: ['à¦¸à§ƒà¦œà¦¨à¦¶à§€à¦²', 'à¦¬à¦¾à¦‚à¦²à¦¾', 'à¦‰à¦¤à§à¦¤à¦°', 'à¦…à¦¨à§à¦šà§à¦›à§‡à¦¦'],
    facts: [
      'à¦¸à§ƒà¦œà¦¨à¦¶à§€à¦² à¦‰à¦¤à§à¦¤à¦°à§‡ à¦†à¦—à§‡ à¦®à§‚à¦² à¦­à¦¾à¦¬, à¦¤à¦¾à¦°à¦ªà¦° à¦¬à§à¦¯à¦¾à¦–à§à¦¯à¦¾, à¦¶à§‡à¦·à§‡ à¦‰à¦¦à¦¾à¦¹à¦°à¦£ à¦²à¦¿à¦–à¦¤à§‡ à¦¹à¦¯à¦¼à¥¤',
      'à¦ªà§à¦°à¦¶à§à¦¨à§‡à¦° à¦¨à¦¿à¦°à§à¦¦à§‡à¦¶à¦• à¦¶à¦¬à§à¦¦ à¦¯à§‡à¦®à¦¨ à¦¬à§à¦¯à¦¾à¦–à§à¦¯à¦¾ à¦•à¦°, à¦¬à¦¿à¦¶à§à¦²à§‡à¦·à¦£ à¦•à¦°, à¦®à§‚à¦²à§à¦¯à¦¾à¦¯à¦¼à¦¨ à¦•à¦° - à¦à¦—à§à¦²à§‹ à¦†à¦—à§‡ à¦§à¦°à¦¤à§‡ à¦¹à¦¬à§‡à¥¤',
      'à¦ªà¦°à¦¿à¦·à§à¦•à¦¾à¦° à¦­à¦¾à¦¬, à¦›à§‹à¦Ÿ à¦…à¦¨à§à¦šà§à¦›à§‡à¦¦ à¦à¦¬à¦‚ à¦ªà¦¾à¦ à§à¦¯à¦¬à¦‡à¦¯à¦¼à§‡à¦° à¦ªà§à¦°à¦¾à¦¸à¦™à§à¦—à¦¿à¦• à¦‰à¦¦à¦¾à¦¹à¦°à¦£ à¦¨à¦®à§à¦¬à¦° à¦¬à¦¾à¦¡à¦¼à¦¾à¦¯à¦¼à¥¤',
    ],
    diagram: 'graph LR\n  A[à¦ªà§à¦°à¦¶à§à¦¨ à¦ªà¦¡à¦¼à§‹] --> B[à¦¨à¦¿à¦°à§à¦¦à§‡à¦¶à¦• à¦¶à¦¬à§à¦¦ à¦§à¦°à§‹]\n  B --> C[à¦®à§‚à¦² à¦­à¦¾à¦¬]\n  C --> D[à¦¬à§à¦¯à¦¾à¦–à§à¦¯à¦¾]\n  D --> E[à¦‰à¦¦à¦¾à¦¹à¦°à¦£]',
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
  if (mode !== 'animation' && mode !== 'video') return null
  if (lessonKey === 'newton_second_law' || lessonKey === 'photosynthesis') return lessonKey
  if (lessonKey === 'quadratic_formula') return 'quadratic_formula'

  const normalized = question.toLowerCase()
  if (/(à¦–à¦¨à¦¿à¦œ|à¦–à¦¨à¦¿à¦œ|mineral|khonij|crystal)/i.test(normalized)) return 'minerals'
  if (/(photosynthesis|à¦¸à¦¾à¦²à§‹à¦•|chlorophyll|co2|oxygen)/i.test(normalized)) return 'photosynthesis'
  if (/(newton|2nd law|second law|f\s*=\s*ma|force)/i.test(normalized)) return 'newton_second_law'

  if (/(quadratic|formula|x\s*(\^2|²)|equation)/i.test(normalized)) return 'quadratic_formula'

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
  if (previousCount > 1 || ['à¦ªà¦¾à¦°à¦›à¦¿ à¦¨à¦¾', 'à¦•à¦ à¦¿à¦¨', 'à¦¹à¦¤à¦¾à¦¶', 'too hard', 'frustrated'].some(word => lc.includes(word))) return 'frustrated'
  if (['à¦¬à§à¦à¦¿ à¦¨à¦¾', 'à¦¬à§à¦à¦²à¦¾à¦® à¦¨à¦¾', 'à¦•à§‡à¦¨', 'à¦•à¦¿à¦­à¦¾à¦¬à§‡', 'à¦¬à§à¦à¦¾à¦“', 'bujhi na', 'bujhao', 'why', 'how'].some(word => lc.includes(word))) return 'confused'
  return 'confident'
}

function introFor(emotion: EmotionState) {
  if (emotion === 'frustrated') return 'à¦šà¦¿à¦¨à§à¦¤à¦¾ à¦•à¦°à§‹ à¦¨à¦¾, à¦–à§à¦¬ à¦›à§‹à¦Ÿ à¦•à¦°à§‡ à¦§à¦°à¦¿à¥¤'
  if (emotion === 'confused') return 'à¦à¦•à¦Ÿà¦¾ à¦¸à¦¹à¦œ à¦‰à¦¦à¦¾à¦¹à¦°à¦£ à¦¦à¦¿à¦¯à¦¼à§‡ à¦¶à§à¦°à§ à¦•à¦°à¦¿à¥¤'
  return 'à¦­à¦¾à¦²à§‹ à¦ªà§à¦°à¦¶à§à¦¨à¥¤'
}

function answerFromLesson(lessonKey: LessonKey, mode: OutputMode, emotion: EmotionState, language: string) {
  const lesson = LESSONS[lessonKey]
  const cultural = language !== 'bn' ? 'CHT example à¦§à¦°à¦²à§‡, jhum farming-à¦à¦° à¦®à¦¤à§‹ à¦à¦–à¦¾à¦¨à§‡ à¦›à§‹à¦Ÿ à¦›à§‹à¦Ÿ à¦…à¦‚à¦¶ à¦®à¦¿à¦²à§‡ à¦ªà§à¦°à§‹ à¦ªà§à¦°à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾ à¦¤à§ˆà¦°à¦¿ à¦¹à¦¯à¦¼à¥¤ ' : ''

  if (mode === 'exam') {
    return `à¦¸à¦‚à¦œà§à¦žà¦¾: ${lesson.facts[0]}\n\nà¦¬à§à¦¯à¦¾à¦–à§à¦¯à¦¾: ${lesson.facts[1]}\n\nà¦—à§à¦°à§à¦¤à§à¦¬/à¦‰à¦¦à¦¾à¦¹à¦°à¦£: ${lesson.facts[2]}\n\nSocratic check: à¦à¦‡ à¦¬à¦¨à§à¦§à¦¨ à¦¬à¦¾ à¦§à¦¾à¦°à¦£à¦¾à¦Ÿà¦¿ à¦•à§‹à¦¨ à¦¬à§ˆà¦¶à¦¿à¦·à§à¦Ÿà§à¦¯ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à¦›à§‡?`
  }

  if (mode === 'simple') {
    return `${introFor(emotion)} ${cultural}${lesson.facts[0]} ${lesson.facts[2]} à¦à¦–à¦¨ à¦¤à§à¦®à¦¿ à¦à¦• à¦²à¦¾à¦‡à¦¨à§‡ à¦¬à¦²à§‹, à¦à¦–à¦¾à¦¨à§‡ à¦®à§‚à¦² à¦†à¦•à¦°à§à¦·à¦£ à¦¬à¦¾ à¦•à¦¾à¦°à¦£à¦Ÿà¦¾ à¦•à§€?`
  }

  return `${introFor(emotion)} ${cultural}${lesson.facts.join(' ')} Socratic check: à¦à¦‡ concept à¦¬à§à¦à¦¤à§‡ à¦•à§‹à¦¨ à¦†à¦—à§‡à¦° à¦§à¦¾à¦°à¦£à¦¾à¦Ÿà¦¾ à¦œà¦¾à¦¨à¦¾ à¦¦à¦°à¦•à¦¾à¦°?`
}

function unknownQuestionFallback(question: string, selectedSubject: string, emotion: EmotionState) {
  const intro = introFor(emotion)
  return `${intro} à¦à¦‡ à¦ªà§à¦°à¦¶à§à¦¨à§‡à¦° à¦œà¦¨à§à¦¯ à¦¨à¦¿à¦°à§à¦­à¦°à¦¯à§‹à¦—à§à¦¯ curriculum context à¦ªà¦¾à¦šà§à¦›à¦¿ à¦¨à¦¾, à¦¤à¦¾à¦‡ à¦­à§à¦² concept à¦§à¦°à§‡ à¦‰à¦¤à§à¦¤à¦° à¦¦à¦¿à¦šà§à¦›à¦¿ à¦¨à¦¾à¥¤ à¦ªà§à¦°à¦¶à§à¦¨à¦Ÿà¦¾ "${question.slice(0, 80)}"à¥¤ à¦¯à¦¦à¦¿ à¦à¦Ÿà¦¾ à¦¤à¦°à¦²à§‡à¦° à¦šà¦¾à¦ª/à¦ªà§à¦°à¦¬à¦¾à¦¹ à¦¨à¦¿à§Ÿà§‡ à¦¹à§Ÿ, à¦®à§‚à¦² à¦§à¦¾à¦°à¦£à¦¾ à¦¹à¦²à§‹: à¦¤à¦°à¦² à¦ªà¦¾à¦¤à§à¦°à§‡à¦° à¦¦à§‡à§Ÿà¦¾à¦² à¦“ à¦¨à¦¿à¦šà§‡à¦° à¦¦à¦¿à¦•à§‡ à¦šà¦¾à¦ª à¦¦à§‡à§Ÿ, à¦†à¦° à¦—à¦­à§€à¦°à¦¤à¦¾ à¦¬à¦¾à§œà¦²à§‡ à¦šà¦¾à¦ª à¦¬à¦¾à§œà§‡à¥¤ à¦¤à§à¦®à¦¿ à¦•à¦¿ "à¦¤à¦°à¦²à§‡à¦° à¦šà¦¾à¦ª" à¦¬à§‹à¦à¦¾à¦¤à§‡ à¦šà§‡à§Ÿà§‡à¦›, à¦¨à¦¾à¦•à¦¿ "à¦¤à¦°à¦²à§‡à¦° à¦ªà§à¦°à¦¬à¦¾à¦¹"?`
}

function directFallbackAnswer(question: string, emotion: EmotionState) {
  const intro = introFor(emotion)
  return `${intro} à¦ªà§à¦°à¦¶à§à¦¨à¦Ÿà¦¾ "${question.slice(0, 80)}"à¥¤ à¦¯à¦¦à¦¿ à¦à¦Ÿà¦¾ à¦¤à¦°à¦²à§‡à¦° à¦šà¦¾à¦ª/à¦ªà§à¦°à¦¬à¦¾à¦¹ à¦¨à¦¿à§Ÿà§‡ à¦¹à§Ÿ, à¦®à§‚à¦² à¦§à¦¾à¦°à¦£à¦¾ à¦¹à¦²à§‹: à¦¤à¦°à¦² à¦ªà¦¾à¦¤à§à¦°à§‡à¦° à¦¦à§‡à§Ÿà¦¾à¦² à¦“ à¦¨à¦¿à¦šà§‡à¦° à¦¦à¦¿à¦•à§‡ à¦šà¦¾à¦ª à¦¦à§‡à§Ÿ, à¦†à¦° à¦—à¦­à§€à¦°à¦¤à¦¾ à¦¬à¦¾à§œà¦²à§‡ à¦šà¦¾à¦ª à¦¬à¦¾à§œà§‡à¥¤ à¦¤à¦°à¦² à¦¸à¦¬à¦¦à¦¿à¦•à§‡ à¦šà¦¾à¦ª à¦ªà§à¦°à§Ÿà§‹à¦— à¦•à¦°à§‡, à¦¤à¦¾à¦‡ à¦ªà¦¾à¦¤à§à¦°à§‡à¦° à¦†à¦•à¦¾à¦° à¦“ à¦—à¦­à§€à¦°à¦¤à¦¾ à¦šà¦¾à¦ªà§‡à¦° à¦ªà§à¦°à¦­à¦¾à¦¬ à¦¬à¦¦à¦²à¦¾à§Ÿà¥¤ à¦¤à§à¦®à¦¿ à¦•à¦¿ "à¦¤à¦°à¦²à§‡à¦° à¦šà¦¾à¦ª" à¦¬à§‹à¦à¦¾à¦¤à§‡ à¦šà§‡à§Ÿà§‡à¦›, à¦¨à¦¾à¦•à¦¿ "à¦¤à¦°à¦²à§‡à¦° à¦ªà§à¦°à¦¬à¦¾à¦¹"?`
}

function safeFallbackAnswer(question: string, emotion: EmotionState) {
  const intro = introFor(emotion)
  const normalized = question.toLowerCase()

  if (/à¦–à¦¨à¦¿à¦œ|à¦§à¦¨à¦¿à¦œ|mineral/.test(normalized)) {
    return `${intro} à¦–à¦¨à¦¿à¦œ à¦ªà¦¦à¦¾à¦°à§à¦¥ à¦¹à¦²à§‹ à¦®à¦¾à¦Ÿà¦¿ à¦¬à¦¾ à¦­à§‚-à¦ªà§ƒà¦·à§à¦ à§‡à¦° à¦¨à¦¿à¦š à¦¥à§‡à¦•à§‡ à¦ªà¦¾à¦“à§Ÿà¦¾ à¦ªà§à¦°à¦¾à¦•à§ƒà¦¤à¦¿à¦• à¦ªà¦¦à¦¾à¦°à§à¦¥, à¦¯à§‡à¦—à§à¦²à§‹ à¦®à¦¾à¦¨à§à¦·à§‡à¦° à¦•à¦¾à¦œà§‡ à¦²à¦¾à¦—à§‡à¥¤ à¦‰à¦¦à¦¾à¦¹à¦°à¦£: à¦²à§‹à¦¹à¦¾, à¦¤à¦¾à¦®à¦¾, à¦¸à§‹à¦¨à¦¾, à¦°à§‚à¦ªà¦¾, à¦•à§Ÿà¦²à¦¾, à¦šà§à¦¨à¦¾à¦ªà¦¾à¦¥à¦°, à¦²à¦¬à¦£, à¦ªà§à¦°à¦¾à¦•à§ƒà¦¤à¦¿à¦• à¦—à§à¦¯à¦¾à¦¸ à¦“ à¦ªà§‡à¦Ÿà§à¦°à§‹à¦²à¦¿à§Ÿà¦¾à¦®à¥¤ à¦à¦—à§à¦²à§‹ à¦¦à¦¿à§Ÿà§‡ à¦˜à¦°à¦¬à¦¾à§œà¦¿, à¦¯à¦¨à§à¦¤à§à¦°à¦ªà¦¾à¦¤à¦¿, à¦—à§Ÿà¦¨à¦¾, à¦œà§à¦¬à¦¾à¦²à¦¾à¦¨à¦¿ à¦“ à¦°à¦¾à¦¸à¦¾à§Ÿà¦¨à¦¿à¦• à¦¦à§à¦°à¦¬à§à¦¯ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à¦¾ à¦¹à§Ÿà¥¤ Socratic check: à¦–à¦¨à¦¿à¦œ à¦ªà¦¦à¦¾à¦°à§à¦¥à§‡à¦° à¦®à¦§à§à¦¯à§‡ à¦•à§‹à¦¨à¦—à§à¦²à§‹ à¦œà§à¦¬à¦¾à¦²à¦¾à¦¨à¦¿ à¦¹à¦¿à¦¸à§‡à¦¬à§‡ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦¹à§Ÿ?`
  }

  if (/à¦¤à¦°à¦²|liquid|fluid/.test(normalized)) {
    return `${intro} à¦¤à¦°à¦² à¦ªà¦¦à¦¾à¦°à§à¦¥à§‡à¦° à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦†à§Ÿà¦¤à¦¨ à¦¥à¦¾à¦•à§‡, à¦•à¦¿à¦¨à§à¦¤à§ à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦†à¦•à¦¾à¦° à¦¥à¦¾à¦•à§‡ à¦¨à¦¾; à¦¯à§‡ à¦ªà¦¾à¦¤à§à¦°à§‡ à¦°à¦¾à¦–à¦¾ à¦¹à§Ÿ à¦¤à¦¾à¦° à¦†à¦•à¦¾à¦° à¦§à¦¾à¦°à¦£ à¦•à¦°à§‡à¥¤ à¦ªà¦¾à¦¨à¦¿, à¦¤à§‡à¦², à¦¦à§à¦§, à¦•à§‡à¦°à§‹à¦¸à¦¿à¦¨ à¦à¦—à§à¦²à§‹ à¦¤à¦°à¦² à¦ªà¦¦à¦¾à¦°à§à¦¥à§‡à¦° à¦‰à¦¦à¦¾à¦¹à¦°à¦£à¥¤ à¦¤à¦°à¦² à¦¸à¦¹à¦œà§‡ à¦ªà§à¦°à¦¬à¦¾à¦¹à¦¿à¦¤ à¦¹à§Ÿ à¦à¦¬à¦‚ à¦ªà¦¾à¦¤à§à¦°à§‡à¦° à¦¦à§‡à§Ÿà¦¾à¦² à¦“ à¦¨à¦¿à¦šà§‡à¦° à¦¦à¦¿à¦•à§‡ à¦šà¦¾à¦ª à¦¦à§‡à§Ÿà¥¤ Socratic check: à¦ªà¦¾à¦¨à¦¿ à¦—à§à¦²à¦¾à¦¸à§‡ à¦°à¦¾à¦–à¦²à§‡ à¦•à§‡à¦¨ à¦—à§à¦²à¦¾à¦¸à§‡à¦° à¦†à¦•à¦¾à¦° à¦¨à§‡à§Ÿ?`
  }

  return `${intro} à¦ªà§à¦°à¦¶à§à¦¨à¦Ÿà¦¾ "${question.slice(0, 80)}"à¥¤ à¦¸à¦¹à¦œà¦­à¦¾à¦¬à§‡ à¦¬à¦²à¦²à§‡, à¦à¦‡ à¦ªà§à¦°à¦¶à§à¦¨à§‡à¦° à¦®à§‚à¦² à¦¶à¦¬à§à¦¦à¦—à§à¦²à§‹ à¦†à¦—à§‡ à¦šà¦¿à¦¹à§à¦¨à¦¿à¦¤ à¦•à¦°à¦¤à§‡ à¦¹à¦¬à§‡, à¦¤à¦¾à¦°à¦ªà¦° à¦¸à¦‚à¦œà§à¦žà¦¾, à¦‰à¦¦à¦¾à¦¹à¦°à¦£ à¦à¦¬à¦‚ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦²à¦¿à¦–à¦¤à§‡ à¦¹à¦¬à§‡à¥¤ à¦¤à§à¦®à¦¿ à¦ªà§à¦°à¦¶à§à¦¨à¦Ÿà¦¾ à¦†à¦°à§‡à¦•à¦Ÿà§ à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦•à¦°à§‡ à¦²à¦¿à¦–à¦²à§‡ à¦†à¦®à¦¿ exact chapter à¦…à¦¨à§à¦¯à¦¾à§Ÿà§€ à¦‰à¦¤à§à¦¤à¦° à¦¸à¦¾à¦œà¦¿à§Ÿà§‡ à¦¦à§‡à¦¬à¥¤ Socratic check: à¦ªà§à¦°à¦¶à§à¦¨à§‡ à¦•à§‹à¦¨ à¦¶à¦¬à§à¦¦à¦Ÿà¦¾ à¦¸à¦¬à¦šà§‡à§Ÿà§‡ à¦—à§à¦°à§à¦¤à§à¦¬à¦ªà§‚à¦°à§à¦£ à¦®à¦¨à§‡ à¦¹à¦šà§à¦›à§‡?`
}

function safeFallbackGraphPath(question: string, selectedSubject: string) {
  const normalized = question.toLowerCase()
  if (/à¦–à¦¨à¦¿à¦œ|à¦§à¦¨à¦¿à¦œ|mineral/.test(normalized)) return ['Geography', 'Natural Resources', 'Minerals']
  if (/à¦¤à¦°à¦²|liquid|fluid/.test(normalized)) return ['Physics', 'Matter', 'Liquid']
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

function fallbackConceptDiagram(fallbackTitle: string) {
  const title = (fallbackTitle || 'Concept').replace(/[[\]{}|"`]/g, ' ').slice(0, 36)
  return `flowchart LR
  A[${title}] --> B[à¦¸à¦‚à¦œà§à¦žà¦¾]
  A --> C[à¦¬à§ˆà¦¶à¦¿à¦·à§à¦Ÿà§à¦¯]
  A --> D[à¦‰à¦¦à¦¾à¦¹à¦°à¦£]
  B --> E[à¦®à§‚à¦² à¦•à¦¾à¦°à¦£]
  C --> E
  D --> F[à¦¬à¦¾à¦¸à§à¦¤à¦¬ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦°]
  E --> G[à¦®à§‚à¦² à¦¶à¦¿à¦•à§à¦·à¦¾]
  F --> G`
}

function safeDiagram(value: unknown, fallbackTitle: string) {
  if (typeof value === 'string' && /^(graph|flowchart)\s+/i.test(value.trim())) return value.trim()
  return fallbackConceptDiagram(fallbackTitle)
}

function fallbackDiagramForQuestion(question: string, fallbackTitle: string) {
  const normalized = question.toLowerCase()
  if (/à¦–à¦¨à¦¿à¦œ|à¦§à¦¨à¦¿à¦œ|mineral/.test(normalized)) {
    return 'graph LR\n  A[à¦ªà§à¦°à¦¾à¦•à§ƒà¦¤à¦¿à¦• à¦‰à§Žà¦¸] --> B[à¦–à¦¨à¦¿à¦œ à¦ªà¦¦à¦¾à¦°à§à¦¥]\n  B --> C[à¦§à¦¾à¦¤à¦¬ à¦–à¦¨à¦¿à¦œ]\n  B --> D[à¦…à¦§à¦¾à¦¤à¦¬ à¦–à¦¨à¦¿à¦œ]\n  B --> E[à¦œà§à¦¬à¦¾à¦²à¦¾à¦¨à¦¿ à¦–à¦¨à¦¿à¦œ]\n  C --> F[à¦²à§‹à¦¹à¦¾ à¦“ à¦¤à¦¾à¦®à¦¾]\n  D --> G[à¦²à¦¬à¦£ à¦“ à¦šà§à¦¨à¦¾à¦ªà¦¾à¦¥à¦°]\n  E --> H[à¦•à§Ÿà¦²à¦¾ à¦“ à¦—à§à¦¯à¦¾à¦¸]'
  }
  if (/à¦¤à¦°à¦²|liquid|fluid/.test(normalized)) {
    return 'graph LR\n  A[à¦¤à¦°à¦² à¦ªà¦¦à¦¾à¦°à§à¦¥] --> B[à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦†à§Ÿà¦¤à¦¨]\n  A --> C[à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦†à¦•à¦¾à¦° à¦¨à§‡à¦‡]\n  A --> D[à¦ªà§à¦°à¦¬à¦¾à¦¹à¦¿à¦¤ à¦¹à§Ÿ]\n  A --> E[à¦šà¦¾à¦ª à¦ªà§à¦°à§Ÿà§‹à¦— à¦•à¦°à§‡]\n  C --> F[à¦ªà¦¾à¦¤à§à¦°à§‡à¦° à¦†à¦•à¦¾à¦° à¦¨à§‡à§Ÿ]'
  }
  return safeDiagram(null, fallbackTitle)
}

function fallbackOcrContextAnswer(question: string, extractedText: string, emotion: EmotionState) {
  const intro = introFor(emotion)
  const readable = extractedText.replace(/\s+/g, ' ').trim().slice(0, 520)
  return `${intro} Uploaded text à¦¥à§‡à¦•à§‡ à¦¯à¦¾ à¦ªà§œà¦¾ à¦¯à¦¾à¦šà§à¦›à§‡: ${readable}${extractedText.length > 520 ? '...' : ''}\n\nà¦¤à§‹à¦®à¦¾à¦° à¦ªà§à¦°à¦¶à§à¦¨: ${question}\n\nà¦à¦‡ text-à¦à¦° à¦­à¦¿à¦¤à§à¦¤à¦¿à¦¤à§‡ à¦†à¦—à§‡ main idea, keyword, à¦†à¦° à¦•à§‹à¦¨à§‹ equation/question number à¦šà¦¿à¦¹à§à¦¨à¦¿à¦¤ à¦•à¦°à§‹à¥¤ à¦¤à¦¾à¦°à¦ªà¦° à¦“à¦‡ à¦…à¦‚à¦¶ à¦§à¦°à§‡ à¦‰à¦¤à§à¦¤à¦° à¦¸à¦¾à¦œà¦¾à¦“à¥¤ à¦¯à¦¦à¦¿ à¦¤à§à¦®à¦¿ specific question number à¦¬à¦²à§‹, à¦†à¦®à¦¿ à¦¸à§‡à¦‡ à¦…à¦‚à¦¶ à¦§à¦°à§‡ à¦†à¦°à¦“ à¦¸à¦°à¦¾à¦¸à¦°à¦¿ answer à¦¸à¦¾à¦œà¦¿à§Ÿà§‡ à¦¦à§‡à¦¬à¥¤ Socratic check: à¦à¦‡ uploaded text-à¦ à¦•à§‹à¦¨ line à¦¬à¦¾ keyword à¦¸à¦¬à¦šà§‡à§Ÿà§‡ à¦—à§à¦°à§à¦¤à§à¦¬à¦ªà§‚à¦°à§à¦£ à¦®à¦¨à§‡ à¦¹à¦šà§à¦›à§‡?`
}

async function dynamicGeminiNode(params: {
  question: string
  selectedSubject: string
  outputMode: OutputMode
  emotion: EmotionState
  language: string
  conceptMemory: unknown
  studentProfile?: StudentProfileContext
  chatContext?: ChatContextItem[]
  curriculumChunks?: RetrievedCurriculumChunk[]
}) {
  const memoryText = Array.isArray(params.conceptMemory)
    ? params.conceptMemory
        .slice(0, 6)
        .map((item: any) => Array.isArray(item.graphPath) ? item.graphPath.join(' -> ') : '')
        .filter(Boolean)
        .join('\n')
    : ''

  const curriculumContext = curriculumContextText(params.curriculumChunks)

  const prompt = `You are VoicePandita's dynamic GraphRAG planner for SSC/HSC/admission students in Bangladesh.
The question may be new and not in the local graph. Create a fresh curriculum-safe concept node.

Student question: ${params.question}
Selected subject from UI: ${params.selectedSubject}
${profileInstruction(params.studentProfile)}
Emotion: ${params.emotion}
Language: ${params.language}
Output mode: ${params.outputMode}
Recent student concept memory:
${memoryText || 'None'}

Recent chat context:
${chatContextText(params.chatContext)}

Retrieved curriculum context:
${curriculumContext}

Return ONLY valid JSON with this shape:
{
  "subject": "Physics/Chemistry/Biology/Math/Bangla/English",
  "conceptTitle": "short concept title",
  "graphPath": ["Subject", "Chapter", "Topic", "Subtopic"],
  "answer": "Bangla answer, max 130 words, exact to the question, no unrelated concept",
  "diagram": "valid Mermaid flowchart LR with 5-8 specific Bangla-labeled nodes; use a natural concept-map shape with branches"
}

Rules:
- Infer the true school subject from the question first; the selected subject may be wrong.
- Must answer the exact question.
- If the question refers to "this/ei/eta/related/previous", resolve it from recent chat context and keep the same concept unless the student clearly changes topic.
- If the student asks repeated words like 'à¦•à¦°à§‹ à¦•à¦°à§‹ à¦•à¦°à§‹', ignore repetition.
- If emotion is confused, use a simple analogy.
- If emotion is frustrated, be short and encouraging.
- Use retrieved curriculum context when relevant. If it is weak or missing, still answer from reliable general knowledge and mention uncertainty only when needed.
- For complex questions, teach in layers: core idea, step-by-step reasoning, example, common mistake, final takeaway.
- End answer with one Socratic follow-up question.
- Do not invent fake textbook references.
- Diagram must be a concept map, not A -> B -> C -> D only.
- Do not add generic nodes like Question/Main idea unless those are truly the topic.
- Good diagram shape: A[main concept] --> B[property]; A --> C[type]; A --> D[example]; C --> E[specific example].`

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
  studentProfile?: StudentProfileContext
  chatContext?: ChatContextItem[]
  curriculumChunks?: RetrievedCurriculumChunk[]
}) {
  const isFollowUp = looksLikeFollowUp(params.question)
  const prompt = `You are VoicePandita, a careful Bangla tutor and concept-map builder for SSC/HSC/admission students in Bangladesh.

Student question: ${params.question}
Selected subject from UI (weak hint only, may be wrong): ${params.selectedSubject}
${profileInstruction(params.studentProfile)}
Emotion: ${params.emotion}
Language: ${params.language}
Output mode: ${params.outputMode}
This question is likely a follow-up to the recent chat: ${isFollowUp ? 'yes' : 'no'}

Recent chat context:
${chatContextText(params.chatContext)}

Retrieved curriculum/textbook context. Use it when relevant; ignore it if it is unrelated:
${curriculumContextText(params.curriculumChunks)}

Return ONLY valid JSON with this shape:
{
  "subject": "best inferred subject in English",
  "conceptTitle": "short English concept title",
  "graphPath": ["Subject", "Chapter/Unit", "Concept"],
  "answer": "Bangla answer, exact to the question, 4-6 clear sentences",
  "diagram": "valid Mermaid flowchart LR with 5-8 specific Bangla-labeled nodes; include natural branches"
}

Rules:
- Do not say curriculum context is missing.
- Do not switch to Newton's law, bonding, or another unrelated concept.
- If this is a follow-up, keep the same topic/chapter from recent chat context unless the student clearly names a new topic.
- For questions like "HSC te ei related ki ki question aste pare?", answer for the previous concept and list likely HSC-style questions for that concept.
- Infer the true subject from the question; ignore the selected subject if it is wrong.
- If retrieved curriculum context is relevant, ground the answer in it.
- If context comes from SSC-BanglaTutor, treat it as the primary SSC/NCTB-aligned evidence.
- If retrieved context is missing or irrelevant, use your reliable general knowledge and answer normally.
- If the question has typo/mixed Bangla-English, infer the likely intended school concept.
- If the question is ambiguous, give the most likely answer first, then ask one short clarifying question.
- For complex questions, explain in layers: main idea, step-by-step reasoning, one concrete example, common mistake, final takeaway.
- For SSC/HSC board goal, include definition/explanation/example style when useful.
- For admission goal, include intuition, formula/logic, and trap warnings when useful.
- Answer should usually be 120-220 words for whiteboard/text mode, 60-100 words for simple mode, and marks-friendly for exam mode.
- Keep Bangla clear and student-friendly; technical English terms are okay when common in textbooks.
- Diagram must not be generic like Question -> Cause -> Result -> Understand.
- Diagram nodes must name the actual concept, types, examples, properties, or process steps.
- Diagram must branch naturally from one main concept into properties/types/examples; do not force unrelated merge nodes.
- Diagram must use this Mermaid style: graph LR\\n  A[à¦®à§‚à¦² à¦§à¦¾à¦°à¦£à¦¾] --> B[à¦ªà§à¦°à¦•à¦¾à¦°]\\n  B --> C[à¦‰à¦¦à¦¾à¦¹à¦°à¦£]
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

async function ocrContextGeminiAnswer(params: {
  question: string
  extractedText: string
  selectedSubject: string
  outputMode: OutputMode
  emotion: EmotionState
  language: string
  studentProfile?: StudentProfileContext
  chatContext?: ChatContextItem[]
  curriculumChunks?: RetrievedCurriculumChunk[]
}) {
  const curriculumContext = curriculumContextText(params.curriculumChunks)

  const prompt = `You are VoicePandita, a helpful tutor for students in Bangladesh.
The student uploaded educational text from an image. Use the extracted text as the primary context.
If the extracted text is incomplete, still answer clearly using general knowledge.
Do not refuse just because curriculum retrieval is weak. Curriculum context should enrich the answer, not block it.

Extracted text from image:
${params.extractedText}

Retrieved curriculum context, if relevant:
${curriculumContext}

Student question about the extracted text:
${params.question}

Selected subject from UI (weak hint only): ${params.selectedSubject}
${profileInstruction(params.studentProfile)}
Emotion: ${params.emotion}
Language: ${params.language}
Output mode: ${params.outputMode}

Recent chat context:
${chatContextText(params.chatContext)}

Return ONLY valid JSON with this shape:
{
  "subject": "best inferred subject in English",
  "conceptTitle": "short English concept title",
  "graphPath": ["Subject", "Chapter/Unit", "Concept"],
  "answer": "Bangla answer, exact to the student's question, clear and helpful",
  "diagram": "valid Mermaid flowchart LR with 5-8 specific Bangla-labeled nodes"
}

Rules:
- Use the extracted text first.
- Use retrieved curriculum context only when it is relevant.
- If the student asks for an answer to a numbered question, answer that question from the extracted text.
- If the student asks to explain, explain simply in Bangla.
- If the uploaded text is incomplete, say what is readable and continue with the most likely explanation.
- Do not say "not in curriculum" unless the student explicitly asks for curriculum-only mode.
- Do not invent fake citations or textbook page numbers.
- End with one short Socratic follow-up question.`

  const raw = await geminiText(prompt)
  if (!raw) throw new Error('Gemini unavailable')

  try {
    const parsed = extractJson(raw)
    const conceptTitle = String(parsed.conceptTitle || params.question.slice(0, 30) || 'OCR Context')
    const graphPath = Array.isArray(parsed.graphPath) && parsed.graphPath.length >= 2
      ? parsed.graphPath.map((part: unknown) => String(part)).slice(0, 6)
      : [String(parsed.subject || params.selectedSubject || 'Uploaded Text'), conceptTitle]

    return {
      answer: String(parsed.answer || raw).trim(),
      diagram: typeof parsed.diagram === 'string' && /^(graph|flowchart)\s+/i.test(parsed.diagram.trim())
        ? safeDiagram(parsed.diagram, conceptTitle)
        : fallbackDiagramForQuestion(`${params.extractedText}\n${params.question}`, conceptTitle),
      graphPath,
    }
  } catch {
    const conceptTitle = params.question.slice(0, 30) || 'OCR Context'
    return {
      answer: raw,
      diagram: fallbackDiagramForQuestion(`${params.extractedText}\n${params.question}`, conceptTitle),
      graphPath: ['Uploaded Text', String(params.selectedSubject || 'General'), conceptTitle],
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
    const studentProfile = body.studentProfile && typeof body.studentProfile === 'object'
      ? {
          level: typeof body.studentProfile.level === 'string' ? body.studentProfile.level : undefined,
          goal: typeof body.studentProfile.goal === 'string' ? body.studentProfile.goal : undefined,
          group: typeof body.studentProfile.group === 'string' ? body.studentProfile.group : undefined,
        }
      : undefined
    const chatContext = Array.isArray(body.chatContext)
      ? body.chatContext.slice(-8).map((item: any) => ({
          role: typeof item?.role === 'string' ? item.role : undefined,
          text: typeof item?.text === 'string' ? item.text : undefined,
          graphPath: Array.isArray(item?.graphPath) ? item.graphPath.map((part: unknown) => String(part)).slice(0, 6) : undefined,
        }))
      : undefined
    const extractedText = String(body.extractedText || '').trim()
    const requestSource = String(body.source || '')
    const conceptSignal = requestSource === 'ocr' && extractedText ? `${extractedText}\n${question}` : question
    const lessonKey = inferLesson(conceptSignal)
    const detectedEmotion = detectEmotion(question, repeatCount)
    const emotion = (body.emotion || detectedEmotion) as EmotionState
    const conceptMemory = body.conceptMemory
    const animationKey = selectedAnimationKey(conceptSignal, outputMode, lessonKey)

    let lesson = lessonKey ? LESSONS[lessonKey] : null
    let answer: string = lessonKey ? answerFromLesson(lessonKey, outputMode, emotion, language) : ''
    let diagram: string = lesson?.diagram || safeDiagram(null, question.slice(0, 30) || 'Concept')
    let graphPath: string[] = lesson ? [...lesson.path] : [selectedSubject || 'Curriculum', 'Needs Clarification']
    let source = genAI ? 'local-graphrag-fallback-after-gemini-error' : 'local-graphrag-fallback-no-key'
    let mode: 'ocr_context' | 'curriculum_guided' | 'general_fallback' = lessonKey ? 'curriculum_guided' : 'general_fallback'
    const grounding = groundingInfo(curriculumChunks, studentProfile)

    try {
      if (requestSource === 'ocr' && extractedText) {
        const ocrAnswer = await ocrContextGeminiAnswer({
          question,
          extractedText,
          selectedSubject,
          outputMode,
          emotion,
          language,
          studentProfile,
          chatContext,
          curriculumChunks,
        })
        answer = ocrAnswer.answer
        diagram = ocrAnswer.diagram
        graphPath = ocrAnswer.graphPath
        source = 'gemini-ocr-context'
        mode = 'ocr_context'
      } else if (!lessonKey) {
        const dynamic = await directGeminiAnswer({
          question,
          selectedSubject,
          outputMode,
          emotion,
          language,
          studentProfile,
          chatContext,
          curriculumChunks,
        })
        answer = dynamic.answer
        diagram = dynamic.diagram
        graphPath = dynamic.graphPath
        source = 'gemini-direct-answer'
        mode = 'general_fallback'
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
${profileInstruction(studentProfile)}
Emotion: ${emotion}
Language: ${language}
Mode: ${outputMode}

Recent chat context:
${chatContextText(chatContext)}

Rules:
- Answer in Bangla.
- Must answer the exact question. Do not switch to another bonding/concept.
- If the student asks a follow-up using "ei/eta/related/previous", keep the topic from recent chat context.
- Explain clearly for the student's level and goal.
- Max 180 words unless exam mode.
- If confused, use an analogy first.
- End with one Socratic follow-up question.`

        const generated = await geminiText(prompt)
        if (generated) {
          answer = generated
          source = 'gemini-graphrag'
          mode = 'curriculum_guided'
        }
      }
    } catch (err) {
      console.warn('/api/ask Gemini unavailable', err instanceof Error ? err.message : err)
      if (requestSource === 'ocr' && extractedText) {
        answer = fallbackOcrContextAnswer(question, extractedText, emotion)
        diagram = fallbackDiagramForQuestion(`${extractedText}\n${question}`, question.slice(0, 30) || 'OCR Context')
        graphPath = ['Uploaded Text', selectedSubject || 'General', question.slice(0, 30) || 'OCR Context']
        source = 'local-ocr-context-fallback'
        mode = 'ocr_context'
      } else if (!answer) {
        throw err
      }
    }

    return NextResponse.json({
      answer,
      diagram: outputMode === 'simple' || outputMode === 'exam' || outputMode === 'video' ? null : polishMermaidDiagram(diagram),
      animationKey,
      detectedEmotion,
      graphPath,
      pwnMessage: 'তুমি একা নও - এই concept নিয়ে অনেক student আটকে যায়।',
      source,
      mode,
      grounding,
    })
  } catch (err) {
    console.error('/api/ask error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        answer: 'à¦¦à§à¦ƒà¦–à¦¿à¦¤, à¦à¦–à¦¨ à¦‰à¦¤à§à¦¤à¦° à¦¤à§ˆà¦°à¦¿ à¦•à¦°à¦¾ à¦¯à¦¾à¦šà§à¦›à§‡ à¦¨à¦¾à¥¤ à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§‹à¥¤',
        diagram: null,
        error: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
    return NextResponse.json({ answer: 'à¦¦à§à¦ƒà¦–à¦¿à¦¤, à¦à¦–à¦¨ à¦‰à¦¤à§à¦¤à¦° à¦¤à§ˆà¦°à¦¿ à¦•à¦°à¦¾ à¦¯à¦¾à¦šà§à¦›à§‡ à¦¨à¦¾à¥¤ à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§‹à¥¤', diagram: null }, { status: 500 })
  }
}
