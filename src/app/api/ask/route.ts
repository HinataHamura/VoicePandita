import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import chakmaBridgeRows from '@/data/chakma/chakmaBridge.json'
import { detectLanguage, normalizeSelectedLanguage as normalizeSelectedLearnLanguage } from '@/lib/multilingual/detectLanguage'
import { detectScriptWithConfidence } from '@/lib/multilingual/detectScript'
import { localizeAnswer as localizeAnswerPhase2 } from '@/lib/multilingual/localizeAnswer'
import {
  formatChakmaExamples,
  prepareChakmaBridge,
  selectChakmaExamples,
  translateBanglaWithDataset,
  type ChakmaBridgeContext,
} from '@/lib/chakmaBridge'
import {
  detectMultilingualRoute,
  normalizeTargetLanguage,
  safeLowResourceFallback,
  targetLanguageToCode,
  type AnswerProvenance,
  type DetectedScript,
  type TargetLanguage,
} from '@/lib/multilingualSupport'
import { formatMarmaExamples, hasMarmaScript, loadMarmaContext } from '@/lib/marmaBridge'
import { fallbackEmbedding } from '@/lib/fallbackEmbedding'
import { buildOfflineAnswer, searchOffline } from '@/lib/offline-search'
import { offlineAiEnabled, runOfflineAsk } from '@/lib/offline/offline-ask'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation' | 'video'
type AnimationKey = 'newton_second_law' | 'photosynthesis' | 'minerals' | 'quadratic_formula' | 'generic_concept'
type EmotionState = 'confident' | 'confused' | 'frustrated'
type CurriculumChunk = {
  content: string
  contextText?: string
  context_text?: string
  contextual_summary?: string
  topic: string
  chapter?: string
  chunk_type?: string
  similarity: number
}
type LocalizedAnswer = {
  answer: string
  diagram: string | null
  targetLanguage: TargetLanguage
  outputScript: DetectedScript
  provenance: AnswerProvenance
  verified: boolean
  sourceSuffix: string
}
type ChakmaBridgeRow = {
  bangla?: string
  bengaliScriptChakma?: string
  romanizedChakma?: string
}

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
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 15000)
const CHAKMA_BENGALI_ROWS = chakmaBridgeRows as ChakmaBridgeRow[]

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

function offlineAskResponsePayload(result: Awaited<ReturnType<typeof runOfflineAsk>>, outputMode: OutputMode) {
  const diagram = outputMode === 'simple' || outputMode === 'exam' || outputMode === 'video' ? null : result.diagram
  return {
    answer: result.answer,
    answerText: result.answer,
    diagram,
    animationKey: null,
    detectedEmotion: 'confident',
    detectedLanguage: 'bn',
    selectedTargetLanguage: 'Bangla',
    outputScript: 'Bengali',
    graphPath: result.graphPath,
    pwnMessage: 'Offline lightweight model চলছে, তাই answer সংক্ষিপ্ত।',
    source: 'ollama-offline-curriculum',
    mode: 'offline_fallback',
    grounding: result.grounding,
    provider: result.provider,
    offline: result.offline,
    model: result.model,
    embeddingModel: result.embeddingModel,
    usedContext: result.usedContext,
    sources: result.sources,
    offlineError: result.error,
  }
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
  const normalized = normalizeQuestionText(question)
  if (/prot[ei]in|protein|প্রোটিন|আমিষ|amino/.test(normalized)) return ['Biology', 'Biomolecules', 'Protein']
  if (/mitochondria|mitocondria|মাইটোকন্ড্র/.test(normalized)) return ['Biology', 'Cell Organelles', 'Mitochondria']
  if (/krebs|kreb|citric|tca|ক্রেবস|সাইট্রিক/.test(normalized)) return ['Biology', 'Cellular Respiration', 'Krebs Cycle']
  if (/complex|জটিল|z\s*=|z\^|1\s*\+\s*i|de moivre|ডি ময়ভার/.test(normalized)) return ['Mathematics', 'Algebra', 'Complex Numbers']
  if (/hcl|naoh|neutral|নিরপেক্ষ|molarity|মোলারিটি/.test(normalized)) return ['Chemistry', 'Acid-Base', 'Molarity']
  if (/force|বল|friction|ঘর্ষণ|acceleration|ত্বরণ|velocity|বেগ/.test(normalized)) return ['Physics', 'Mechanics', 'Newtonian Motion']
  if (/glucose|গ্লুকোজ/.test(normalized)) return ['Biology', 'Carbohydrate', 'Glucose']
  if (/à¦–à¦¨à¦¿à¦œ|à¦§à¦¨à¦¿à¦œ|mineral/.test(normalized)) return ['Geography', 'Natural Resources', 'Minerals']
  if (/à¦¤à¦°à¦²|liquid|fluid/.test(normalized)) return ['Physics', 'Matter', 'Liquid']
  return [selectedSubject || 'Curriculum', 'General Question']
}

async function geminiText(prompt: string) {
  const requested = process.env.GEMINI_MODEL?.trim()
  const models = (requested
    ? [requested, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']
    : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'])
    .filter((modelName, index, allModels): modelName is string => Boolean(modelName) && allModels.indexOf(modelName) === index)

  let lastError: unknown = null
  if (genAI) {
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            topP: 0.85,
          },
        })
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
        max_tokens: 1400,
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

function isGeminiQuotaOrRateLimit(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /429|too many requests|quota|rate limit|resource_exhausted/i.test(message)
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

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

async function generateServerEmbedding(text: string) {
  const embedUrl = process.env.NEXT_PUBLIC_TTS_URL || 'http://localhost:8001'
  try {
    const response = await fetch(`${embedUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) throw new Error(`Embeddings API error: ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.embedding) || data.embedding.length !== 384) {
      throw new Error('Embedding endpoint did not return a 384-dim vector')
    }
    return data.embedding as number[]
  } catch {
    return fallbackEmbedding(text)
  }
}

async function retrieveCurriculumChunks(query: string, providedChunks?: unknown): Promise<CurriculumChunk[]> {
  if (Array.isArray(providedChunks) && providedChunks.length > 0) {
    return providedChunks
      .filter((chunk): chunk is CurriculumChunk => typeof chunk?.content === 'string' && typeof chunk?.topic === 'string')
      .slice(0, 5)
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  try {
    const embedding = await generateServerEmbedding(query)
    const { data, error } = await supabase.rpc('search_curriculum', {
      query_embedding: embedding,
      similarity_threshold: 0.45,
      match_count: 4,
    })

    if (error) throw error

    const chunks = (data || [])
      .filter((chunk: any) =>
        typeof chunk.content === 'string' &&
        !chunk.content.trim().toLowerCase().startsWith('student question:')
      )
      .map((chunk: any) => ({
        ...chunk,
        contextText: chunk.context_text || [chunk.contextual_summary, chunk.content].filter(Boolean).join('\n\n'),
      }))
      .slice(0, 4)

    console.info('[VectorRAG] Retrieved curriculum chunks', {
      count: chunks.length,
      topics: chunks.map((chunk: CurriculumChunk) => chunk.topic).filter(Boolean),
    })
    return chunks
  } catch (err) {
    console.warn('[VectorRAG] Curriculum retrieval fallback', err instanceof Error ? err.message : err)
    return []
  }
}

function formatBengaliScriptChakmaExamples(limit = 12) {
  return CHAKMA_BENGALI_ROWS
    .filter(row => row.bangla && row.bengaliScriptChakma)
    .slice(0, limit)
    .map(row => `Bangla: ${row.bangla}\nChakma in Bengali script: ${row.bengaliScriptChakma}`)
    .join('\n\n')
}

function formatRomanizedChakmaExamples(limit = 12) {
  return CHAKMA_BENGALI_ROWS
    .filter(row => row.bangla && row.romanizedChakma)
    .slice(0, limit)
    .map(row => `Bangla: ${row.bangla}\nRomanized Chakma: ${row.romanizedChakma}`)
    .join('\n\n')
}

function normalizeLowResourcePhrase(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[।?!,;:"'‘’“”()[\]{}\-–—.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasScript(text: string, script: DetectedScript) {
  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0
    if (script === 'Bengali' && codePoint >= 0x0980 && codePoint <= 0x09ff) return true
    if (script === 'Chakma' && codePoint >= 0x11100 && codePoint <= 0x1114f) return true
    if (script === 'Myanmar' && codePoint >= 0x1000 && codePoint <= 0x109f) return true
    if (script === 'Latin' && ((codePoint >= 0x0041 && codePoint <= 0x005a) || (codePoint >= 0x0061 && codePoint <= 0x007a))) return true
  }
  return script === 'Unknown'
}

async function translateQuestionToBangla(params: {
  originalQuestion: string
  route: ReturnType<typeof detectMultilingualRoute>
  bridge: ChakmaBridgeContext
}) {
  const { originalQuestion, route, bridge } = params
  if (route.language === 'Bangla' || route.language === 'English' || route.language === 'unknown') return originalQuestion

  if (route.language === 'Chakma' && route.outputScript === 'Chakma') {
    return translateChakmaQuestionWithGemini(originalQuestion, bridge)
  }

  const normalizedOriginal = normalizeLowResourcePhrase(originalQuestion)
  const exactChakmaBengali = route.language === 'Chakma'
    ? CHAKMA_BENGALI_ROWS.find(row =>
        row.bengaliScriptChakma &&
        normalizeLowResourcePhrase(row.bengaliScriptChakma) === normalizedOriginal
      )
    : null
  if (exactChakmaBengali?.bangla) return exactChakmaBengali.bangla

  if (!genAI) return originalQuestion

  const scriptInstruction = route.outputScript === 'Bengali'
    ? 'The student wrote the low-resource language using Bengali script/Bangla horof.'
    : route.outputScript === 'Latin'
      ? 'The student wrote the low-resource language in Romanized Latin form.'
      : 'The student used a native script.'
  const examples = route.language === 'Chakma'
    ? `\nExamples:\n${route.outputScript === 'Latin' ? formatRomanizedChakmaExamples(10) : formatBengaliScriptChakmaExamples(10)}\n`
    : ''

  const prompt = `Translate the student question into Standard Bangla for curriculum retrieval.
Language: ${route.language}
Detection detail: ${route.detail}
${scriptInstruction}
${examples}
Student question:
${originalQuestion}

Return ONLY the Standard Bangla question. Preserve formulas, symbols, and English scientific terms. If uncertain, keep the educational intent and do not add new facts.`

  try {
    const translated = await geminiText(prompt)
    return translated?.trim() || originalQuestion
  } catch (err) {
    console.warn('/api/ask low-resource question translation failed', err instanceof Error ? err.message : err)
    return originalQuestion
  }
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

function stripJsonLeak(text: string, fallbackQuestion: string) {
  const cleaned = text.replace(/```json|```/gi, '').trim()
  if (!/^\s*\{/.test(cleaned) && !/"answer"\s*:/.test(cleaned)) return text.trim()

  const answerMatch = cleaned.match(/"answer"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"(?:diagram|graphPath|subject|conceptTitle)"|"\s*\})/)
  if (answerMatch?.[1]) {
    const answer = answerMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\')
      .trim()
    if (answer.length > 20 && !looksMojibake(answer)) return answer
  }

  return fallbackAnswerForQuestion(fallbackQuestion)
}

function looksMojibake(value: string) {
  return /à¦|à§|Ã|Â/.test(value)
}

function normalizeQuestionText(question: string) {
  return question
    .toLowerCase()
    .replace(/\bprotien\b/g, 'protein')
    .replace(/\bmitocondria\b/g, 'mitochondria')
    .replace(/\bphotosynthsis\b/g, 'photosynthesis')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAskedConcept(question: string) {
  const cleaned = question
    .normalize('NFKC')
    .replace(/[?？।]/g, ' ')
    .replace(/\b(ki|kake bole|bolte ki bujhay|what is|explain|define|bekkha|bujhao|koro|korun)\b/gi, ' ')
    .replace(/কি|কী|কাকে বলে|বলতে কী বোঝায়|ব্যাখ্যা করো|বুঝাও|করো|করুন/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || question.trim()
}

function genericStructuredFallback(question: string, selectedSubject = 'general') {
  const concept = extractAskedConcept(question).slice(0, 80)
  const subjectLabel = selectedSubject && selectedSubject !== 'general' ? selectedSubject : 'এই বিষয়'
  return `আমি প্রশ্নটা "${concept}" নিয়ে ধরেছি।

মূল ধারণা:
${concept} সম্পর্কে ভালো উত্তর দিতে হলে আগে এর সংজ্ঞা, গঠন/ধরন, কাজ, উদাহরণ এবং গুরুত্ব আলাদা করতে হবে।

বোর্ড-স্টাইল উত্তর সাজানোর নিয়ম:
১. প্রথমে ${concept}-এর সংক্ষিপ্ত সংজ্ঞা লিখবে।
২. তারপর ${subjectLabel}-এর সাথে এর সম্পর্ক লিখবে।
৩. ২-৩টি বৈশিষ্ট্য বা কাজ লিখবে।
৪. একটি বাস্তব/পাঠ্যবই-ধরনের উদাহরণ দেবে।
৫. শেষে এক লাইনে গুরুত্ব বা ফলাফল লিখবে।

নোট:
এখন AI provider quota/rate-limit হলে আমি verified factual detail কমিয়ে safe structure দিচ্ছি। প্রশ্নটা আরেকটু নির্দিষ্ট করলে বা provider available হলে আমি exact answer দেব।`
}

function fallbackAnswerForQuestion(question: string) {
  const normalized = normalizeQuestionText(question)
  if (/prot[ei]in|protein|প্রোটিন|আমিষ|amino/.test(normalized)) {
    return `সংজ্ঞা:
প্রোটিন হলো amino acid দিয়ে গঠিত একটি জৈব অণু। এটি দেহের বৃদ্ধি, ক্ষয়পূরণ এবং কোষের বিভিন্ন কাজের জন্য দরকারি।

গঠন:
অনেকগুলো amino acid peptide bond দিয়ে যুক্ত হয়ে protein chain তৈরি করে।

কাজ:
প্রোটিন পেশি ও টিস্যু গঠন করে, enzyme ও hormone তৈরিতে সাহায্য করে, antibody তৈরি করে রোগ প্রতিরোধে ভূমিকা রাখে এবং ক্ষতিগ্রস্ত কোষ মেরামতে সাহায্য করে।

উদাহরণ:
ডিম, মাছ, মাংস, দুধ, ডাল, শিম, বাদাম প্রোটিনের ভালো উৎস।

সাধারণ ভুল:
প্রোটিন শুধু muscle বানায় না; enzyme, hormone, antibody এবং cell repair-এও কাজ করে।`
  }
  if (/mitochondria|mitocondria|মাইটোকন্ড্র/.test(normalized)) {
    return `সংজ্ঞা:
মাইটোকন্ড্রিয়া হলো কোষের শক্তি উৎপাদনকারী অঙ্গাণু, যাকে কোষের শক্তিঘর বলা হয়।

অবস্থান:
এটি কোষের সাইটোপ্লাজমে থাকে।

কাজ:
মাইটোকন্ড্রিয়া কোষশ্বসনের মাধ্যমে খাদ্য থেকে শক্তি বের করে ATP তৈরি করে। ম্যাট্রিক্সে ক্রেবস চক্র চলে, আর ভিতরের ঝিল্লিতে Electron Transport Chain ATP উৎপাদনে সাহায্য করে।

গুরুত্ব:
ATP কোষের চলন, বৃদ্ধি, বিভাজন, পরিবহন ও বিপাকীয় কাজের শক্তি দেয়।

সাধারণ ভুল:
মাইটোকন্ড্রিয়া খাদ্য তৈরি করে না; খাদ্য থেকে শক্তি/ATP তৈরি করে।`
  }
  if (/krebs|kreb|citric|tca|ক্রেবস|সাইট্রিক/.test(normalized)) {
    return `সংজ্ঞা:
ক্রেবস চক্র বা সাইট্রিক অ্যাসিড চক্র হলো কোষশ্বসনের একটি চক্রাকার ধাপ।

অবস্থান:
এটি মাইটোকন্ড্রিয়ার ম্যাট্রিক্সে ঘটে।

ধাপ:
Acetyl-CoA থেকে Citrate তৈরি হয়, তারপর Isocitrate, Alpha-ketoglutarate, Succinyl-CoA, Succinate, Fumarate, Malate হয়ে Oxaloacetate পুনরায় তৈরি হয়।

উৎপন্ন পদার্থ/ফলাফল:
প্রতি Acetyl-CoA থেকে NADH, FADH2, ATP/GTP এবং CO2 তৈরি হয়।

গুরুত্ব:
NADH ও FADH2 পরে Electron Transport Chain-এ ATP উৎপাদনে সাহায্য করে।`
  }
  if (/glucose|গ্লুকোজ/.test(normalized)) {
    return 'গ্লুকোজ হলো একটি সরল শর্করা বা monosaccharide। এটি জীবদেহের প্রধান শক্তির উৎস; কোষ শ্বসনে গ্লুকোজ ভেঙে ATP তৈরি হয়। উদ্ভিদ সালোকসংশ্লেষণের মাধ্যমে গ্লুকোজ বানায়, আর প্রাণী খাবার থেকে গ্লুকোজ পায়। সহজভাবে বললে, গ্লুকোজ হলো কোষের দ্রুত ব্যবহারযোগ্য জ্বালানি। তুমি কি গ্লুকোজ আর starch-এর পার্থক্য জানতে চাও?'
  }
  if (/photosynthesis|সালোক/.test(normalized)) {
    return 'সালোকসংশ্লেষণ হলো উদ্ভিদের খাদ্য তৈরির প্রক্রিয়া। সবুজ উদ্ভিদ সূর্যের আলো, পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে গ্লুকোজ তৈরি করে এবং অক্সিজেন ছাড়ে। ক্লোরোফিল আলো ধরতে সাহায্য করে। তুমি কি পুরো equation-টা দেখতে চাও?'
  }
  return genericStructuredFallback(question)
}

function fallbackConceptDiagram(fallbackTitle: string) {
  const title = (fallbackTitle || 'Concept').replace(/[[\]{}|"`]/g, ' ').slice(0, 36)
  return `flowchart LR
  A[${title}] --> B[সংজ্ঞা]
  A --> C[বৈশিষ্ট্য]
  A --> D[উদাহরণ]
  B --> E[মূল কারণ]
  C --> E
  D --> F[বাস্তব ব্যবহার]
  E --> G[মূল শিক্ষা]
  F --> G`
}

function isGenericDiagram(value: string, question?: string) {
  const labels = Array.from(value.matchAll(/\[([^\]]+)\]/g)).map(match => match[1].trim().toLowerCase())
  const genericLabels = new Set([
    'সংজ্ঞা',
    'বৈশিষ্ট্য',
    'উদাহরণ',
    'মূল কারণ',
    'মূল শিক্ষা',
    'বাস্তব ব্যবহার',
    'প্রশ্ন',
    'main idea',
    'definition',
    'example',
    'property',
  ])
  const genericCount = labels.filter(label => genericLabels.has(label)).length
  const rootLooksLikeQuestion = question
    ? labels.some(label => label.includes(question.toLowerCase().slice(0, 28)))
    : false
  return genericCount >= 3 || rootLooksLikeQuestion
}

function specificDiagramForQuestion(question: string) {
  const normalized = normalizeQuestionText(question)
  if (/prot[ei]in|protein|প্রোটিন|আমিষ|amino/.test(normalized)) {
    return `flowchart LR
  A[প্রোটিন] --> B[Amino acid]
  B --> C[Peptide bond]
  C --> D[Protein chain]
  A --> E[দেহ গঠন ও বৃদ্ধি]
  A --> F[Enzyme ও hormone]
  A --> G[Antibody]
  A --> H[Cell repair]
  A --> I[খাদ্য উৎস]
  I --> J[ডিম মাছ দুধ ডাল]`
  }
  if (/mitochondria|mitocondria|মাইটোকন্ড্র/.test(normalized)) {
    return `flowchart LR
  A[মাইটোকন্ড্রিয়া] --> B[কোষের শক্তিঘর]
  A --> C[কোষশ্বসন]
  C --> D[গ্লুকোজ ভাঙে]
  D --> E[ATP শক্তি তৈরি]
  A --> F[ম্যাট্রিক্স]
  F --> G[ক্রেবস চক্র]
  A --> H[ভিতরের ঝিল্লি]
  H --> I[Electron Transport Chain]
  I --> E
  A --> J[তাপ ও বিপাকে সহায়তা]`
  }
  if (/krebs|kreb|citric|tca|ক্রেবস|সাইট্রিক/.test(normalized)) {
    return `flowchart LR
  A[Acetyl-CoA] --> B[Citrate]
  B --> C[Isocitrate]
  C --> D[Alpha-ketoglutarate]
  D --> E[Succinyl-CoA]
  E --> F[Succinate]
  F --> G[Fumarate]
  G --> H[Malate]
  H --> I[Oxaloacetate]
  I --> B
  C --> J[NADH + CO2]
  D --> K[NADH + CO2]
  E --> L[ATP/GTP]
  F --> M[FADH2]
  H --> N[NADH]`
  }
  if (/complex|জটিল|z\s*=|z\^|1\s*\+\s*i|de moivre|ডি ময়ভার/.test(normalized)) {
    return `flowchart LR
  A[z = 1 + i] --> B[z^2 = 2i]
  B --> C[z^4 = -4]
  C --> D[z^8 = 16]
  D --> E[1/z^8 = 1/16]
  D --> F[z^8 + 1/z^8]
  E --> F
  F --> G[257/16]`
  }
  if (/hcl|naoh|neutral|নিরপেক্ষ|molarity|মোলারিটি/.test(normalized)) {
    return `flowchart LR
  A[HCl + NaOH] --> B[NaCl + H2O]
  B --> C[মোল অনুপাত 1:1]
  C --> D[M_HCl V_HCl = M_NaOH V_NaOH]
  D --> E[M_HCl = 0.1 x 30 / 25]
  E --> F[0.12 M]`
  }
  if (/force|বল|friction|ঘর্ষণ|acceleration|ত্বরণ|velocity|বেগ/.test(normalized)) {
    return `flowchart LR
  A[প্রয়োগকৃত বল 10 N] --> B[ঘর্ষণ 2 N বাদ]
  B --> C[নেট বল 8 N]
  C --> D[a = F/m = 4 m/s^2]
  D --> E[v = u + at = 20 m/s]
  D --> F[s = ut + 1/2at^2 = 50 m]`
  }
  return null
}

function safeDiagram(value: unknown, fallbackTitle: string, question?: string) {
  const specific = question ? specificDiagramForQuestion(question) : null
  if (specific) return specific
  if (typeof value === 'string' && /^(graph|flowchart)\s+/i.test(value.trim()) && !looksMojibake(value) && !isGenericDiagram(value, question)) {
    return value.trim()
  }
  return fallbackDiagramForQuestion(question || fallbackTitle, fallbackTitle)
}

function extractMermaid(text: string) {
  const cleaned = text.replace(/```mermaid|```/gi, '').trim()
  const start = cleaned.search(/(?:graph|flowchart)\s+(?:LR|TD|TB|RL|BT)/i)
  if (start < 0) return cleaned
  return cleaned.slice(start).trim()
}

function acceptedDiagram(value: unknown, question: string) {
  const specific = specificDiagramForQuestion(question)
  if (specific) return specific
  if (typeof value !== 'string') return null
  const diagram = extractMermaid(value)
  if (!/^(graph|flowchart)\s+/i.test(diagram)) return null
  if (looksMojibake(diagram)) return null
  if (isGenericDiagram(diagram, question)) return null
  return diagram
}

async function bestDiagramForAnswer(params: {
  candidate: unknown
  question: string
  answer: string
  graphPath: string[]
  subject: string
}) {
  const accepted = acceptedDiagram(params.candidate, params.question)
  if (accepted) return accepted
  if (!genAI) return null

  const prompt = `Create one high-quality Mermaid concept map for this student answer.

Student question:
${params.question}

Inferred path:
${params.graphPath.join(' -> ') || params.subject}

Answer:
${params.answer.slice(0, 1800)}

Return ONLY Mermaid code.

Rules:
- Use flowchart LR.
- Use 6-10 nodes.
- Every node must be a real concept, formula, step, component, cause, result, or example from the answer.
- Never use generic nodes like সংজ্ঞা, বৈশিষ্ট্য, উদাহরণ, মূল কারণ, মূল শিক্ষা, বাস্তব ব্যবহার, প্রশ্ন, main idea, definition, property, example.
- If it is a process, show the actual sequence.
- If it is a numerical problem, show the actual formula/calculation flow.
- If it is an organelle/biology function question, show structure -> function -> result links.
- Keep labels short so they fit in boxes.
- No markdown fence.`

  try {
    const generated = await geminiText(prompt)
    return acceptedDiagram(generated || '', params.question)
  } catch (err) {
    console.warn('/api/ask diagram regeneration failed', err instanceof Error ? err.message : err)
    return null
  }
}

function fallbackDiagramForQuestion(question: string, fallbackTitle: string) {
  const normalized = question.toLowerCase()
  const specific = specificDiagramForQuestion(question)
  if (specific) return specific
  if (/glucose|গ্লুকোজ/.test(normalized)) {
    return 'graph LR\n  A[গ্লুকোজ] --> B[সরল শর্করা]\n  A --> C[কোষের শক্তি]\n  A --> D[সালোকসংশ্লেষণে তৈরি]\n  A --> E[খাবার থেকে পাওয়া যায়]\n  C --> F[ATP তৈরি]\n  D --> G[উদ্ভিদের খাদ্য]'
  }
  if (/à¦–à¦¨à¦¿à¦œ|à¦§à¦¨à¦¿à¦œ|mineral/.test(normalized)) {
    return 'graph LR\n  A[à¦ªà§à¦°à¦¾à¦•à§ƒà¦¤à¦¿à¦• à¦‰à§Žà¦¸] --> B[à¦–à¦¨à¦¿à¦œ à¦ªà¦¦à¦¾à¦°à§à¦¥]\n  B --> C[à¦§à¦¾à¦¤à¦¬ à¦–à¦¨à¦¿à¦œ]\n  B --> D[à¦…à¦§à¦¾à¦¤à¦¬ à¦–à¦¨à¦¿à¦œ]\n  B --> E[à¦œà§à¦¬à¦¾à¦²à¦¾à¦¨à¦¿ à¦–à¦¨à¦¿à¦œ]\n  C --> F[à¦²à§‹à¦¹à¦¾ à¦“ à¦¤à¦¾à¦®à¦¾]\n  D --> G[à¦²à¦¬à¦£ à¦“ à¦šà§à¦¨à¦¾à¦ªà¦¾à¦¥à¦°]\n  E --> H[à¦•à§Ÿà¦²à¦¾ à¦“ à¦—à§à¦¯à¦¾à¦¸]'
  }
  if (/à¦¤à¦°à¦²|liquid|fluid/.test(normalized)) {
    return 'graph LR\n  A[à¦¤à¦°à¦² à¦ªà¦¦à¦¾à¦°à§à¦¥] --> B[à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦†à§Ÿà¦¤à¦¨]\n  A --> C[à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦†à¦•à¦¾à¦° à¦¨à§‡à¦‡]\n  A --> D[à¦ªà§à¦°à¦¬à¦¾à¦¹à¦¿à¦¤ à¦¹à§Ÿ]\n  A --> E[à¦šà¦¾à¦ª à¦ªà§à¦°à§Ÿà§‹à¦— à¦•à¦°à§‡]\n  C --> F[à¦ªà¦¾à¦¤à§à¦°à§‡à¦° à¦†à¦•à¦¾à¦° à¦¨à§‡à§Ÿ]'
  }
  return fallbackConceptDiagram(fallbackTitle)
}

function learnerLanguageToTargetLanguage(language: string): TargetLanguage {
  if (language === 'chakma') return 'Chakma'
  if (language === 'garo') return 'Garo'
  if (language === 'marma') return 'Marma'
  return 'Bangla'
}

function learnerScriptToDetectedScript(script: string): DetectedScript {
  if (script === 'bengali') return 'Bengali'
  if (script === 'latin') return 'Latin'
  if (script === 'chakma') return 'Chakma'
  if (script === 'myanmar') return 'Myanmar'
  return 'Unknown'
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
    diagram: await bestDiagramForAnswer({
      candidate: parsed.diagram,
      question: params.question,
      answer: String(parsed.answer || '').trim(),
      graphPath,
      subject: String(parsed.subject || params.selectedSubject || 'Curriculum'),
    }),
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
  "answer": "Bangla answer, exact to the question. Use newline-separated sections. For numerical/math problems include প্রদত্ত, সূত্র/ধারণা, সমাধান, চূড়ান্ত উত্তর, সাধারণ ভুল.",
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
- For math/physics/chemistry numerical problems, solve carefully step by step:
  1. Extract given values with units.
  2. Write the needed formula/equation.
  3. Substitute values visibly.
  4. Keep units through the calculation.
  5. Box or clearly state the final answer.
  6. For multi-part creative/CQ questions, label answers as (ক), (খ), (গ), (ঘ).
- Format numerical answers with clear Bangla section labels and blank lines:
  প্রদত্ত:
  ...

  সূত্র/ধারণা:
  ...

  সমাধান:
  ...

  চূড়ান্ত উত্তর:
  ...

  সাধারণ ভুল:
  ...
- Do not use প্রদত্ত/সূত্র/সমাধান/চূড়ান্ত উত্তর formatting for non-numerical biology concept explanations.
- For biology process explanations such as Krebs cycle, photosynthesis, respiration, mitosis, or meiosis, use:
  সংজ্ঞা:
  অবস্থান:
  ধাপ:
  উৎপন্ন পদার্থ/ফলাফল:
  গুরুত্ব:
  সাধারণ ভুল:
- For algebra/calculus/complex-number/trigonometry problems, show transformations line by line and verify the final result when possible.
- For chemistry stoichiometry, write the balanced equation, mole ratio, unit conversion, and final concentration/mass/volume.
- For physics, state assumptions such as friction direction, initial velocity, or constant acceleration before calculating.
- For SSC/HSC board goal, include definition/explanation/example style when useful.
- For admission goal, include intuition, formula/logic, and trap warnings when useful.
- Answer should usually be 120-260 words for whiteboard/text mode, 60-100 words for simple mode, and marks-friendly with labeled steps for exam mode.
- Keep Bangla clear and student-friendly; technical English terms are okay when common in textbooks.
- Diagram must not be generic like Question -> Cause -> Result -> Understand.
- Diagram must not use generic Bangla nodes like সংজ্ঞা, বৈশিষ্ট্য, উদাহরণ, মূল কারণ, মূল শিক্ষা, বাস্তব ব্যবহার unless those are genuinely the requested topic.
- Diagram nodes must name the actual concept, types, examples, properties, or process steps.
- Diagram must branch naturally from one main concept into properties/types/examples; do not force unrelated merge nodes.
- For biology process questions, diagram the real process sequence. For Krebs/Citric acid/TCA cycle, include Acetyl-CoA, Citrate, Isocitrate, Alpha-ketoglutarate, Succinyl-CoA, Succinate, Fumarate, Malate, Oxaloacetate, NADH/FADH2/ATP/CO2.
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
      diagram: await bestDiagramForAnswer({
        candidate: parsed.diagram,
        question: params.question,
        answer: String(parsed.answer || raw).trim(),
        graphPath,
        subject: String(parsed.subject || params.selectedSubject || 'Curriculum'),
      }),
      graphPath,
    }
  } catch {
    const conceptTitle = params.question.slice(0, 30) || 'Concept'
    return {
      answer: stripJsonLeak(raw, params.question),
      diagram: specificDiagramForQuestion(params.question),
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
      diagram: await bestDiagramForAnswer({
        candidate: parsed.diagram,
        question: `${params.extractedText}\n${params.question}`,
        answer: String(parsed.answer || raw).trim(),
        graphPath,
        subject: String(parsed.subject || params.selectedSubject || 'Uploaded Text'),
      }),
      graphPath,
    }
  } catch {
    const conceptTitle = params.question.slice(0, 30) || 'OCR Context'
    return {
      answer: stripJsonLeak(raw, params.question),
      diagram: specificDiagramForQuestion(`${params.extractedText}\n${params.question}`),
      graphPath: ['Uploaded Text', String(params.selectedSubject || 'General'), conceptTitle],
    }
  }
}

async function translateBanglaAnswerToChakmaBengaliScript(params: {
  banglaAnswer: string
  originalQuestion: string
  subjectContext: string
}) {
  const deterministic = CHAKMA_BENGALI_ROWS
    .filter(row => row.bangla && row.bengaliScriptChakma)
    .sort((a, b) => String(b.bangla).length - String(a.bangla).length)
    .reduce((text, row) => text.split(String(row.bangla)).join(String(row.bengaliScriptChakma)), params.banglaAnswer)

  if (!genAI) return deterministic

  const prompt = `Translate this grounded Bangla tutoring answer into Chakma language written with Bengali script/Bangla horof.
Use the verified phrase examples only as style/vocabulary guidance. Do not claim perfect translation.

Examples:
${formatBengaliScriptChakmaExamples(16)}

Student question:
${params.originalQuestion}

Subject context: ${params.subjectContext}

Grounded Bangla answer:
${params.banglaAnswer}

Rules:
- Return only the student-facing Chakma answer in Bengali script.
- Preserve formulas, symbols, and school science terms when a reliable Chakma equivalent is unavailable.
- Keep the Socratic follow-up as a short question.
- Do not output native Chakma Unicode script.`

  try {
    const generated = await geminiText(prompt)
    const answer = generated?.trim() || ''
    return answer && hasScript(answer, 'Bengali') ? answer : deterministic
  } catch (err) {
    console.warn('/api/ask Chakma Bengali-script answer generation failed', err instanceof Error ? err.message : err)
    return deterministic
  }
}

async function translateBanglaAnswerToChakmaRomanized(params: {
  banglaAnswer: string
  originalQuestion: string
  subjectContext: string
}) {
  if (!genAI) return params.banglaAnswer

  const prompt = `Translate this grounded Bangla tutoring answer into Romanized Chakma.
Use the verified examples only as style/vocabulary guidance. Do not claim perfect translation.

Examples:
${formatRomanizedChakmaExamples(16)}

Student question:
${params.originalQuestion}

Subject context: ${params.subjectContext}

Grounded Bangla answer:
${params.banglaAnswer}

Rules:
- Return only the student-facing answer in Romanized Chakma.
- Preserve formulas, symbols, and school science terms when a reliable Chakma equivalent is unavailable.
- Keep it simple for a school student.`

  try {
    const generated = await geminiText(prompt)
    const answer = generated?.trim() || ''
    return answer && hasScript(answer, 'Latin') ? answer : params.banglaAnswer
  } catch (err) {
    console.warn('/api/ask Romanized Chakma answer generation failed', err instanceof Error ? err.message : err)
    return params.banglaAnswer
  }
}

function translateBanglaToGaroBengaliScriptFallback(value: string) {
  return value
    .replace(/সালোকসংশ্লেষণ/g, 'ফটোসিন্থেসিস')
    .replace(/উদ্ভিদ/g, 'সাম বলরাং')
    .replace(/আলো/g, 'সালনি তেংসু')
    .replace(/পানি/g, 'চি')
    .replace(/খাদ্য/g, 'চাআনিকো')
    .replace(/ব্যাখ্যা/g, 'তালাতানি')
    .replace(/উদাহরণ/g, 'মেসোকানি')
    .replace(/প্রশ্ন/g, 'সিংআনিকো')
}

async function translateBanglaAnswerToLowResourceScript(params: {
  banglaAnswer: string
  originalQuestion: string
  targetLanguage: Exclude<TargetLanguage, 'Bangla' | 'Chakma'>
  outputScript: DetectedScript
  subjectContext: string
}) {
  const scriptLabel = params.outputScript === 'Bengali'
    ? 'Bengali script/Bangla horof'
    : params.outputScript === 'Latin'
      ? 'Romanized Latin form'
      : params.targetLanguage === 'Marma'
        ? 'Myanmar script'
        : 'Latin-script A.chik/Garo style'

  const deterministic = params.targetLanguage === 'Garo' && params.outputScript === 'Bengali'
    ? translateBanglaToGaroBengaliScriptFallback(params.banglaAnswer)
    : params.targetLanguage === 'Garo'
      ? translateBanglaToGaroText(params.banglaAnswer)
      : params.outputScript === 'Myanmar'
        ? translateBanglaToMarmaScript(params.banglaAnswer)
        : params.banglaAnswer

  if (!genAI) return deterministic

  const prompt = `Translate this grounded Bangla tutoring answer into ${params.targetLanguage}.
Output script: ${scriptLabel}
This is a low-resource language. Do not claim perfect translation and do not invent unsupported school terms.

Student question:
${params.originalQuestion}

Subject context: ${params.subjectContext}

Grounded Bangla answer:
${params.banglaAnswer}

Rules:
- Return only the student-facing answer in ${params.targetLanguage} using ${scriptLabel}.
- Preserve formulas, symbols, and school science terms when no reliable local equivalent is available.
- Keep it simple for a school student.
- Do not include an availability warning; metadata will carry provenance.`

  try {
    const generated = await geminiText(prompt)
    const answer = generated?.trim() || ''
    if (!answer) return deterministic
    if (params.outputScript !== 'Unknown' && !hasScript(answer, params.outputScript)) return deterministic
    return answer
  } catch (err) {
    console.warn(`/api/ask ${params.targetLanguage} ${params.outputScript} answer generation failed`, err instanceof Error ? err.message : err)
    return deterministic
  }
}

async function localizeAnswer(params: {
  banglaAnswer: string
  diagram: string | null
  route: ReturnType<typeof detectMultilingualRoute>
  bridge: ChakmaBridgeContext
  originalQuestion: string
  inputLanguage: string
  subjectContext: string
}) : Promise<LocalizedAnswer> {
  const { banglaAnswer, diagram, route, bridge, originalQuestion, inputLanguage, subjectContext } = params

  if (route.shouldFallbackToBangla && route.targetLanguage !== 'Bangla') {
    return {
      answer: `${safeLowResourceFallback(route.targetLanguage as Exclude<TargetLanguage, 'Bangla'>)}\n\n${banglaAnswer}`,
      diagram,
      targetLanguage: 'Bangla',
      outputScript: 'Bengali',
      provenance: 'fallback',
      verified: false,
      sourceSuffix: `${route.targetLanguage.toLowerCase()}-low-confidence-fallback`,
    }
  }

  if (route.targetLanguage === 'Bangla') {
    return {
      answer: banglaAnswer,
      diagram,
      targetLanguage: 'Bangla',
      outputScript: 'Bengali',
      provenance: 'verified',
      verified: true,
      sourceSuffix: 'bangla-grounded',
    }
  }

  if (route.targetLanguage === 'Chakma') {
    let answer = banglaAnswer
    if (route.outputScript === 'Bengali') {
      answer = await translateBanglaAnswerToChakmaBengaliScript({ banglaAnswer, originalQuestion, subjectContext })
    } else if (route.outputScript === 'Latin') {
      answer = await translateBanglaAnswerToChakmaRomanized({ banglaAnswer, originalQuestion, subjectContext })
    } else {
      answer = await translateBanglaAnswerToChakma(banglaAnswer, bridge)
    }

    return {
      answer,
      diagram: route.outputScript === 'Chakma' ? localizeDiagram(diagram, 'Chakma', bridge) : diagram,
      targetLanguage: 'Chakma',
      outputScript: route.outputScript,
      provenance: 'generated',
      verified: false,
      sourceSuffix: `chakma-${route.outputScript.toLowerCase()}-${bridge.source}`,
    }
  }

  if (route.targetLanguage === 'Marma' && route.outputScript === 'Myanmar') {
    return {
      answer: await translateBanglaAnswerToMarma({ banglaAnswer, originalQuestion, inputLanguage, subjectContext }),
      diagram: localizeDiagram(diagram, 'Marma', bridge),
      targetLanguage: 'Marma',
      outputScript: 'Myanmar',
      provenance: 'generated',
      verified: false,
      sourceSuffix: 'marma-corpus-bridge',
    }
  }

  const lowResourceAnswer = await translateBanglaAnswerToLowResourceScript({
    banglaAnswer,
    originalQuestion,
    targetLanguage: route.targetLanguage as Exclude<TargetLanguage, 'Bangla' | 'Chakma'>,
    outputScript: route.outputScript,
    subjectContext,
  })

  return {
    answer: lowResourceAnswer,
    diagram: route.outputScript === 'Bengali' || route.outputScript === 'Latin'
      ? diagram
      : localizeDiagram(diagram, route.targetLanguage, bridge),
    targetLanguage: route.targetLanguage,
    outputScript: route.outputScript,
    provenance: 'generated',
    verified: false,
    sourceSuffix: `${route.targetLanguage.toLowerCase()}-${route.outputScript.toLowerCase()}-safe-routing`,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const originalQuestion = String(body.question || '').trim()
    if (!originalQuestion) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const outputMode = String(body.outputMode || 'whiteboard') as OutputMode
    const selectedTargetLanguage = normalizeTargetLanguage(body.selected_target_language || body.target_language || body.language || 'Bangla')
    const selectedLanguageForDetection = normalizeSelectedLearnLanguage(body.language || body.selected_target_language || body.target_language || selectedTargetLanguage)
    const scriptDetection = detectScriptWithConfidence(originalQuestion)
    const languageDetection = detectLanguage({
      text: originalQuestion,
      selectedLanguage: selectedLanguageForDetection,
    })
    const route = detectMultilingualRoute(originalQuestion, selectedTargetLanguage)
    const targetLanguage = route.targetLanguage
    const language = targetLanguageToCode(targetLanguage)
    const inputLanguage = languageDetection.language
    const repeatCount = Number(body.repeatCount || 0)
    const selectedSubject = String(body.subject || 'physics')
    if ((body.offlineMode === true || body.offline === true) && offlineAiEnabled()) {
      const offlineResult = await runOfflineAsk({
        question: originalQuestion,
        subject: selectedSubject,
        classLevel: typeof body.classLevel === 'string' ? body.classLevel : undefined,
        language: typeof body.language === 'string' ? body.language : 'bn',
      })
      return NextResponse.json(offlineAskResponsePayload(offlineResult, outputMode), {
        status: offlineResult.usedContext ? 200 : offlineResult.error ? 503 : 200,
      })
    }
    if (body.offline === true) {
      const [offlineResult] = await searchOffline(originalQuestion, {
        baseUrl: new URL(req.url).origin,
        limit: 1,
      })
      const offline = buildOfflineAnswer(offlineResult, originalQuestion)
      return NextResponse.json({
        answer: offline.answer,
        answerText: offline.answer,
        diagram: outputMode === 'simple' || outputMode === 'exam' || outputMode === 'video' ? null : offline.diagram,
        animationKey: null,
        detectedEmotion: 'confident',
        detectedLanguage: 'bn',
        selectedTargetLanguage: 'Bangla',
        outputScript: 'Bengali',
        graphPath: offline.graphPath,
        pwnMessage: 'Offline Mode: using locally cached curriculum.',
        source: 'offline-curriculum-cache',
        mode: 'offline_fallback',
        grounding: { grounded: true, label: 'Offline curriculum cache', sourceDataset: 'public/offline-data', similarity: offlineResult?.score || null },
      })
    }
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
    const bridge = await prepareChakmaBridge(originalQuestion, language)
    const question = await translateQuestionToBangla({ originalQuestion, route, bridge })
    const curriculumChunks = await retrieveCurriculumChunks(question, body.curriculumChunks)
    const conceptSignal = requestSource === 'ocr' && extractedText ? `${extractedText}\n${question}` : question
    const lessonKey = inferLesson(conceptSignal)
    const detectedEmotion = detectEmotion(question, repeatCount)
    const emotion = (body.emotion || detectedEmotion) as EmotionState
    const conceptMemory = body.conceptMemory
    const animationKey = selectedAnimationKey(conceptSignal, outputMode, lessonKey)

    let lesson = lessonKey ? LESSONS[lessonKey] : null
    let answer: string = lessonKey ? answerFromLesson(lessonKey, outputMode, emotion, language) : ''
    let diagram: string | null = lesson?.diagram || specificDiagramForQuestion(conceptSignal)
    let graphPath: string[] = lesson ? [...lesson.path] : [selectedSubject || 'Curriculum', 'Needs Clarification']
    let source = genAI ? 'local-graphrag-fallback-after-gemini-error' : 'local-graphrag-fallback-no-key'
    let mode: 'ocr_context' | 'curriculum_guided' | 'general_fallback' = lessonKey ? 'curriculum_guided' : 'general_fallback'
    const grounding = groundingInfo(curriculumChunks, studentProfile)
    let offlineProvider: 'ollama' | null = null
    let offlineModel: string | null = null
    let offlineEmbeddingModel: string | null = null
    let offlineUsedContext = false
    let offlineSources: unknown[] = []
    let offlineGrounding: {
      grounded: boolean
      label: string
      sourceDataset: string | null
      similarity: number | null
    } | null = null

    try {
      if (/glucose|গ্লুকোজ/.test(conceptSignal.toLowerCase())) {
        answer = fallbackAnswerForQuestion(question)
        diagram = fallbackDiagramForQuestion(question, 'Glucose')
        graphPath = ['Biology', 'Carbohydrate', 'Glucose']
        source = 'local-known-concept'
        mode = 'curriculum_guided'
      } else if (requestSource === 'ocr' && extractedText) {
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
      if (offlineAiEnabled()) {
        const offlineResult = await runOfflineAsk({
          question,
          subject: selectedSubject,
          classLevel: typeof body.classLevel === 'string' ? body.classLevel : undefined,
          language,
        })
        answer = offlineResult.answer
        diagram = offlineResult.diagram
        graphPath = offlineResult.graphPath
        source = offlineResult.error ? 'ollama-offline-fallback-with-local-pack' : 'ollama-offline-curriculum'
        mode = 'curriculum_guided'
        offlineProvider = offlineResult.provider
        offlineModel = offlineResult.model
        offlineEmbeddingModel = offlineResult.embeddingModel
        offlineUsedContext = offlineResult.usedContext
        offlineSources = offlineResult.sources
        offlineGrounding = offlineResult.grounding
      } else if (requestSource === 'ocr' && extractedText) {
        answer = fallbackOcrContextAnswer(question, extractedText, emotion)
        diagram = specificDiagramForQuestion(`${extractedText}\n${question}`)
        graphPath = ['Uploaded Text', selectedSubject || 'General', question.slice(0, 30) || 'OCR Context']
        source = 'local-ocr-context-fallback'
        mode = 'ocr_context'
      } else if (!answer) {
        answer = fallbackAnswerForQuestion(question)
        diagram = specificDiagramForQuestion(conceptSignal)
        graphPath = safeFallbackGraphPath(question, selectedSubject)
        source = 'local-question-specific-fallback'
      }
    }

    const safeAnswer = stripJsonLeak(answer, question)
    const safeOutputDiagram = outputMode === 'simple' || outputMode === 'exam' || outputMode === 'video'
      ? null
      : diagram
        ? polishMermaidDiagram(diagram)
        : null
    const localized = await localizeAnswerPhase2({
      banglaAnswer: safeAnswer,
      question: originalQuestion,
      languageDetection,
      scriptDetection,
      selectedLanguage: selectedLanguageForDetection,
      subjectContext: Array.isArray(graphPath) ? graphPath.join(' -> ') : selectedSubject,
      generateText: geminiText,
    })
    const resolvedTargetLanguage = learnerLanguageToTargetLanguage(localized.metadata.outputLanguage)
    const resolvedOutputScript = learnerScriptToDetectedScript(localized.metadata.outputScript)
    const sourceScript = learnerScriptToDetectedScript(localized.metadata.sourceScript)
    const languageSource = `${source}+phase2-${localized.metadata.outputLanguage}-${localized.metadata.outputScript}${localized.metadata.fallbackUsed ? '-fallback' : '-generated'}`

    return NextResponse.json({
      answerText: localized.answerText,
      answer: localized.answerText,
      metadata: localized.metadata,
      diagram: safeOutputDiagram && looksMojibake(safeOutputDiagram) ? null : safeOutputDiagram,
      animationKey,
      detectedEmotion,
      detectedLanguage: localized.metadata.sourceLanguage,
      detectedLanguageDetail: route.detail,
      detectedScript: sourceScript,
      selectedTargetLanguage: resolvedTargetLanguage,
      requestedTargetLanguage: selectedTargetLanguage,
      outputScript: resolvedOutputScript,
      languageConfidence: localized.metadata.detectionConfidence,
      languageMetadata: {
        detectedLanguage: localized.metadata.sourceLanguage,
        detectedLanguageDetail: route.detail,
        detectedScript: sourceScript,
        selectedTargetLanguage,
        resolvedTargetLanguage,
        outputScript: resolvedOutputScript,
        confidence: localized.metadata.detectionConfidence,
        translationConfidence: localized.metadata.translationConfidence,
        verified: localized.metadata.verified,
        provenance: localized.metadata.fallbackUsed ? 'fallback' : localized.metadata.verified ? 'verified' : 'generated',
        fallback: localized.metadata.fallbackUsed,
        reasons: languageDetection.reasons,
      },
      translatedQuestion: question !== originalQuestion ? question : null,
      curriculumChunkCount: curriculumChunks.length,
      graphPath,
      pwnMessage: 'তুমি একা নও - এই concept নিয়ে অনেক student আটকে যায়।',
      source: languageSource,
      mode,
      grounding,
      ...(offlineProvider
        ? {
            offline: true,
            provider: offlineProvider,
            model: offlineModel,
            embeddingModel: offlineEmbeddingModel,
            usedContext: offlineUsedContext,
            sources: offlineSources,
            grounding: offlineGrounding || grounding,
          }
        : {}),
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
