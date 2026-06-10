'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Accessibility, Camera, FileText, Globe, Loader2, Mic, MicOff, RotateCcw, Send, Sparkles, ThumbsDown, Trash2, Volume2, VolumeX, WifiOff, Zap } from 'lucide-react'
import BdslAvatar from '@/components/BdslAvatar'
import EmotionBadge from '@/components/EmotionBadge'
import MermaidDiagram from '@/components/MermaidDiagram'
import OutputModeSelector from '@/components/OutputModeSelector'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/components/LanguageProvider'
import Sidebar from '@/components/Sidebar'
import SubjectSelector from '@/components/SubjectSelector'
import StudyBuddyInviteCard from '@/components/study-buddy/StudyBuddyInviteCard'
import ManimVideoAnimation from '@/components/animations/ManimVideoAnimation'
import TeachingAnimation from '@/components/animations/TeachingAnimation'
import type { AnimationKey } from '@/components/animations/types'
import { getAuthenticatedStudent } from '@/lib/authFlow'
import { getConceptMemory, getStudentProfile, recordChatHistory, recordConceptMemory, recordPractice } from '@/lib/studentStore'
import { searchCurriculum } from '@/lib/embeddings'
import { createClient, syncSupabaseAuthRefreshWithNetwork } from '@/lib/supabase/client'
import { buildOfflineAnswer, searchOffline } from '@/lib/offline-search'
import { isOnline as getNetworkOnline, subscribeNetworkChanges } from '@/lib/network'
import { appendChatMessages, createChatSession, fetchChatMessages, flushPendingHistorySync, migrateLocalHistoryToSupabase, queuePendingHistorySync, recordOfflineChat } from '@/lib/services/chatHistory'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation' | 'video'
type EmotionState = 'confident' | 'confused' | 'frustrated' | null
type LanguageMode = 'bn' | 'ckm' | 'mrm' | 'gnk'
type AnswerProvenance = 'verified' | 'generated' | 'fallback'

const LANGUAGE_LABEL_BY_CODE: Record<LanguageMode, string> = {
  bn: 'Bangla',
  ckm: 'Chakma',
  mrm: 'Marma',
  gnk: 'Garo',
}

type OcrResult = {
  success: boolean
  text: string
  source: 'gemini' | 'fallback'
  needsReview: boolean
  error?: string
}

const OCR_IMAGE_MAX_SIDE = 1280
const OCR_IMAGE_QUALITY = 0.82

async function optimizeImageForOcr(file: File) {
  if (!file.type.startsWith('image/')) return file

  const image = await loadImage(file)
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
  const scale = longestSide > OCR_IMAGE_MAX_SIDE ? OCR_IMAGE_MAX_SIDE / longestSide : 1
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  if (scale === 1 && file.size < 900 * 1024 && file.type === 'image/jpeg') {
    URL.revokeObjectURL(image.src)
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    URL.revokeObjectURL(image.src)
    return file
  }

  context.drawImage(image, 0, 0, width, height)
  URL.revokeObjectURL(image.src)

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', OCR_IMAGE_QUALITY)
  })

  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '.jpg'), { type: 'image/jpeg' })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image.'))
    }
    image.src = url
  })
}

const ANSWER_SECTION_LABELS = [
  'প্রদত্ত:',
  'সূত্র/ধারণা:',
  'সূত্র:',
  'ধারণা:',
  'সমাধান:',
  'গণনা:',
  'চূড়ান্ত উত্তর:',
  'চূড়ান্ত উত্তর:',
  'সাধারণ ভুল:',
  'যাচাই:',
  'সংজ্ঞা:',
  'অবস্থান:',
  'ধাপ:',
  'উৎপন্ন পদার্থ/ফলাফল:',
  'ফলাফল:',
  'গুরুত্ব:',
]

function renderMathInline(text: string) {
  const tokenPattern = /(1\/[A-Za-z]\^\d+|\d+\/\d+|\^\([^)]+\)|\^\d+|√\([^)]+\)|√\d+)/g
  const nodes: JSX.Element[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor, match.index)}</span>)
    }

    const token = match[0]
    if (token.startsWith('1/') && token.includes('^')) {
      const denominator = token.slice(2)
      nodes.push(
        <span key={`f-${match.index}`} className="mx-0.5 inline-flex translate-y-1 flex-col items-center align-middle text-[0.92em] leading-none">
          <span className="border-b border-ink/60 px-1">1</span>
          <span className="px-1">{renderMathInline(denominator)}</span>
        </span>
      )
    } else if (/^\d+\/\d+$/.test(token)) {
      const [numerator, denominator] = token.split('/')
      nodes.push(
        <span key={`f-${match.index}`} className="mx-0.5 inline-flex translate-y-1 flex-col items-center align-middle text-[0.92em] leading-none">
          <span className="border-b border-ink/60 px-1">{numerator}</span>
          <span className="px-1">{denominator}</span>
        </span>
      )
    } else if (token.startsWith('^')) {
      const power = token.slice(1).replace(/^\((.*)\)$/, '$1')
      nodes.push(<sup key={`p-${match.index}`} className="ml-0.5 text-[0.68em] font-semibold leading-none">{power}</sup>)
    } else {
      nodes.push(<span key={`r-${match.index}`}>{token}</span>)
    }

    cursor = match.index + token.length
  }

  if (cursor < text.length) nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>)
  return nodes
}

function looksLikeEquationLine(text: string) {
  return /([=+\-*/]|√|\^|\d+\/\d+|π|θ| m\/s| kg| N\b| M\b)/.test(text) && /[0-9A-Za-z]/.test(text)
}

function FormattedAnswer({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')

  return (
    <div className="bangla space-y-2 leading-relaxed text-ink">
      {lines.map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={index} className="h-1" />

        const isFinal = /^চূ[ড়ড়]ান্ত উত্তর:/.test(trimmed)
        const isSection = ANSWER_SECTION_LABELS.some(label => trimmed === label || trimmed.startsWith(label))

        if (isFinal) {
          const [, value = ''] = trimmed.split(/চূ[ড়ড়]ান্ত উত্তর:\s*/)
          return (
            <div key={index} className="rounded-lg border border-forest/20 bg-forest/8 px-3 py-2 font-semibold text-forest">
              <span>চূড়ান্ত উত্তর</span>
              {value && <span className="ml-2 text-ink">{value}</span>}
            </div>
          )
        }

        if (isSection) {
          return (
            <div key={index} className="pt-1 text-sm font-semibold text-indigo">
              {trimmed}
            </div>
          )
        }

        if (looksLikeEquationLine(trimmed)) {
          return (
            <div key={index} className="overflow-x-auto rounded-md bg-white/60 px-3 py-2 font-mono text-[0.96rem] leading-7 text-ink shadow-sm ring-1 ring-indigo/8">
              {renderMathInline(trimmed)}
            </div>
          )
        }

        return <p key={index}>{renderMathInline(trimmed)}</p>
      })}
    </div>
  )
}

interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  diagram?: string | null
  animationKey?: AnimationKey | null
  emotion?: EmotionState
  targetLanguage?: string
  requestedTargetLanguage?: string
  languageConfidence?: number
  outputScript?: string
  answerProvenance?: AnswerProvenance
  languageFallback?: boolean
  verified?: boolean
  pwnMessage?: string
  graphPath?: string[]
  outputMode?: OutputMode
  studyQuestion?: string
  studyConceptHint?: string
  offline?: boolean
  provider?: string
  model?: string
  embeddingModel?: string
  grounding?: {
    grounded: boolean
    label?: string
    sourceDataset?: string | null
    similarity?: number | null
  }
  loading?: boolean
}

type OfflineHealth = {
  ok: boolean
  enabled: boolean
  provider: 'ollama'
  model: string
  embeddingModel: string
  error?: string
}

const QUICK_QUESTIONS = [
  'Newton-er second law bujhi na',
  'Photosynthesis process bujhao',
  'খনিজ পদার্থ কী?',
]

function isVisualMode(mode: OutputMode) {
  return mode === 'animation' || mode === 'video'
}

const OFFLINE_ANSWERS: Record<string, string> = {
  physics: 'Offline pack: F = ma মানে বল = ভর × ত্বরণ। একই ভরে বেশি বল দিলে ত্বরণ বেশি হয়।',
  chemistry: 'Offline pack: আয়নিক বন্ধনে এক পরমাণু ইলেকট্রন ছাড়ে, অন্যটি নেয়। বিপরীত আধান আকর্ষণ করে বন্ধন বানায়।',
  biology: 'Offline pack: সালোকসংশ্লেষণে উদ্ভিদ আলো, CO2 ও পানি ব্যবহার করে গ্লুকোজ ও অক্সিজেন তৈরি করে।',
  math: 'Offline pack: ax²+bx+c=0 হলে x = (-b ± √(b²-4ac)) / 2a সূত্রে মান বসাও।',
  bangla: 'Offline pack: সৃজনশীল উত্তরে মূল ভাব, ব্যাখ্যা, উদাহরণ - এই তিন ধাপ রাখো।',
  english: 'Offline pack: Start with one short correct sentence, then add details.',
}

const DIAGRAM_LANGUAGE_PAIRS: Array<[string, string]> = [
  ['মূল ধারণা', 'Main concept'],
  ['প্রকার', 'Type'],
  ['উদাহরণ', 'Example'],
  ['সংজ্ঞা', 'Definition'],
  ['বৈশিষ্ট্য', 'Key features'],
  ['মূল কারণ', 'Main reason'],
  ['বাস্তব ব্যবহার', 'Real use'],
  ['মূল শিক্ষা', 'Core idea'],
  ['প্রাকৃতিক উৎস', 'Natural source'],
  ['খনিজ পদার্থ', 'Mineral substance'],
  ['ধাতব খনিজ', 'Metallic mineral'],
  ['অধাতব খনিজ', 'Non-metallic mineral'],
  ['জ্বালানি খনিজ', 'Fuel mineral'],
  ['লোহা ও তামা', 'Iron and copper'],
  ['লবণ ও চুনাপাথর', 'Salt and limestone'],
  ['কয়লা ও গ্যাস', 'Coal and gas'],
  ['তরল পদার্থ', 'Liquid substance'],
  ['নির্দিষ্ট আয়তন', 'Fixed volume'],
  ['নির্দিষ্ট আকার নেই', 'No fixed shape'],
  ['প্রবাহিত হয়', 'Can flow'],
  ['চাপ প্রয়োগ করে', 'Applies pressure'],
  ['পাত্রের আকার নেয়', 'Takes container shape'],
  ['বল F', 'Force F'],
  ['ভর m', 'Mass m'],
  ['ত্বরণ a', 'Acceleration a'],
  ['গতি পরিবর্তন', 'Motion change'],
  ['ধাতু পরমাণু', 'Metal atom'],
  ['মুক্ত ইলেকট্রন', 'Free electrons'],
  ['ধনাত্মক ধাতব আয়ন', 'Positive metal ion'],
  ['ইলেকট্রনের সাগর', 'Sea of electrons'],
  ['আকর্ষণ', 'Attraction'],
  ['ধাতব বন্ধন', 'Metallic bond'],
  ['ধাতু', 'Metal'],
  ['অধাতু', 'Non-metal'],
  ['ইলেকট্রন ছাড়ে', 'Loses electron'],
  ['ইলেকট্রন নেয়', 'Gains electron'],
  ['ধনাত্মক আয়ন', 'Positive ion'],
  ['ঋণাত্মক আয়ন', 'Negative ion'],
  ['আয়নিক বন্ধন', 'Ionic bond'],
  ['আলো', 'Light'],
  ['সালোকসংশ্লেষণ', 'Photosynthesis'],
  ['পানি', 'Water'],
  ['গ্লুকোজ', 'Glucose'],
  ['অক্সিজেন', 'Oxygen'],
  ['a,b,c বের করো', 'Find a,b,c'],
  ['সূত্রে বসাও', 'Use formula'],
  ['x এর মান', 'Value of x'],
  ['যাচাই', 'Check answer'],
  ['প্রশ্ন পড়ো', 'Read question'],
  ['নির্দেশক শব্দ ধরো', 'Find command word'],
  ['মূল ভাব', 'Main idea'],
  ['ব্যাখ্যা', 'Explanation'],
]

function localizeWhiteboardDiagram(chart: string, uiLanguage: 'bn' | 'en') {
  return DIAGRAM_LANGUAGE_PAIRS.reduce((nextChart, [bn, en]) => {
    const from = uiLanguage === 'en' ? bn : en
    const to = uiLanguage === 'en' ? en : bn
    return nextChart.split(from).join(to)
  }, chart)
}

const OFFLINE_AI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_OFFLINE_AI === 'true'
const OFFLINE_EVENT_KEY = 'vp_offline_learning_events'

type OfflineEventName =
  | 'offline_question_asked'
  | 'offline_answer_generated'
  | 'offline_tts_played'
  | 'offline_bujhi_nai_clicked'

function recordOfflineLearningEvent(event: OfflineEventName, metadata: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_EVENT_KEY) || '[]') as Array<Record<string, unknown>>
    existing.push({
      event,
      metadata,
      createdAt: new Date().toISOString(),
      synced: false,
    })
    localStorage.setItem(OFFLINE_EVENT_KEY, JSON.stringify(existing.slice(-100)))
  } catch {
    // Local event tracking should never block the tutor flow.
  }
}

function bestVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => v.lang.toLowerCase().startsWith('bn')) ||
    voices.find(v => /bangla|bengali/i.test(v.name)) ||
    voices.find(v => v.lang.toLowerCase().startsWith('hi')) ||
    voices.find(v => v.lang.toLowerCase().startsWith('en')) ||
    voices[0] ||
    null
  )
}

function speakText(text: string, emotion?: EmotionState) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return

  window.speechSynthesis.cancel()
  const voice = bestVoice()
  const chunks = clean.match(/.{1,180}(?:[।.!?]\s|$)/g) || [clean]

  chunks.forEach(chunk => {
    const utterance = new SpeechSynthesisUtterance(chunk.trim())
    utterance.lang = voice?.lang || 'bn-BD'
    utterance.rate = emotion === 'frustrated' ? 0.82 : emotion === 'confused' ? 0.9 : 1
    utterance.pitch = 1
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
  })
}

function getSessionId() {
  if (typeof window === 'undefined') return 'server'
  const existing = localStorage.getItem('vp_session_id')
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem('vp_session_id', id)
  return id
}

function localEmotionHint(question: string, repeatCount: number): Exclude<EmotionState, null> {
  const lc = question.toLowerCase()
  if (repeatCount > 1 || ['পারছি না', 'কঠিন', 'too hard', 'frustrated'].some(word => lc.includes(word))) return 'frustrated'
  if (['বুঝি না', 'কেন', 'কিভাবে', 'bujhi na', 'bujhao', 'why', 'how'].some(word => lc.includes(word))) return 'confused'
  return 'confident'
}

function recentChatContext(messages: Message[]) {
  return messages
    .filter(msg => !msg.loading && msg.text.trim())
    .slice(-6)
    .map(msg => ({
      role: msg.role,
      text: msg.text.slice(0, 900),
      graphPath: msg.graphPath,
    }))
}

function followUpAnchor(messages: Message[]) {
  const recentAi = [...messages].reverse().find(msg => msg.role === 'ai' && !msg.loading && (msg.graphPath?.length || msg.text.trim()))
  if (!recentAi) return ''
  return [
    recentAi.graphPath?.length ? `Previous topic: ${recentAi.graphPath.join(' -> ')}` : '',
    recentAi.text ? `Previous answer: ${recentAi.text.slice(0, 700)}` : '',
  ].filter(Boolean).join('\n')
}

const OUTPUT_LANGUAGE_LABELS: Record<string, string> = {
  bangla: 'বাংলা',
  bengali: 'বাংলা',
  bn: 'বাংলা',
  chakma: 'চাকমা',
  garo: 'গারো',
  marma: 'মারমা',
}

const OUTPUT_SCRIPT_LABELS: Record<string, string> = {
  bengali: 'বাংলা হরফ',
  latin: 'English horof',
}

const LOW_RESOURCE_FALLBACK_MESSAGE = 'এই ভাষা/হরফে যাচাইকৃত ডেটা সীমিত, তাই বাংলা ব্যাখ্যাও দেওয়া হলো।'
const EXPERIMENTAL_VOICE_MESSAGE = 'এই ভাষার ভয়েস এখনো পরীক্ষামূলক।'

function normalizedKey(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function answerOutputLabel(message: Message) {
  const languageKey = normalizedKey(message.targetLanguage)
  const scriptKey = normalizedKey(message.outputScript)
  const languageLabel = OUTPUT_LANGUAGE_LABELS[languageKey] || message.targetLanguage || 'বাংলা'

  if (languageLabel === 'বাংলা') return 'উত্তর ভাষা: বাংলা'

  const scriptLabel = OUTPUT_SCRIPT_LABELS[scriptKey]
  return scriptLabel ? `উত্তর ভাষা: ${languageLabel} · ${scriptLabel}` : `উত্তর ভাষা: ${languageLabel}`
}

function usesRomanizedLowResourceOutput(message: Message) {
  return ['chakma', 'garo', 'marma'].includes(normalizedKey(message.targetLanguage)) && normalizedKey(message.outputScript) === 'latin'
}

export default function LearnPage() {
  const { language: uiLanguage, t } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [subject, setSubject] = useState('physics')
  const [outputMode, setOutputMode] = useState<OutputMode>('whiteboard')
  const [language, setLanguage] = useState<LanguageMode>('bn')
  const [emotion, setEmotion] = useState<EmotionState>(null)
  const [voiceOutput, setVoiceOutput] = useState(true)
  const [deafMode, setDeafMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [ocrQuestion, setOcrQuestion] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [showOcrReview, setShowOcrReview] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [offlineHealth, setOfflineHealth] = useState<OfflineHealth | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [questionHistory, setQuestionHistory] = useState<string[]>([])
  const [manualStudyInvite, setManualStudyInvite] = useState<{ messageId: string; questionText: string; conceptHint?: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const chunksRef = useRef<Blob[]>([])

  async function refreshOfflineHealth() {
    if (!OFFLINE_AI_ENABLED) return
    try {
      const res = await fetch('/api/offline-health', { cache: 'no-store' })
      const data = (await res.json()) as OfflineHealth
      setOfflineHealth(data)
    } catch {
      setOfflineHealth({
        ok: false,
        enabled: true,
        provider: 'ollama',
        model: 'qwen2.5:0.5b',
        embeddingModel: 'embeddinggemma:300m-qat-q4_0',
        error: 'Ollama চালু নেই. Terminal এ `ollama run qwen2.5:0.5b` চালাও।',
      })
    }
  }

  useEffect(() => {
    getAuthenticatedStudent().then(student => {
      if (!student) {
        window.location.replace('/login?next=/learn')
      }
    })
    setIsOnline(getNetworkOnline())
    const params = new URLSearchParams(window.location.search)
    const seededQuestion = params.get('q')
    const seededSession = params.get('session')
    const mode = params.get('mode') as OutputMode | null
    const languageParam = params.get('language') as LanguageMode | null
    if (seededQuestion) setInput(seededQuestion)
    if (mode && ['whiteboard', 'animation', 'video'].includes(mode)) setOutputMode(mode)
    if (languageParam && ['bn', 'ckm', 'mrm', 'gnk'].includes(languageParam)) setLanguage(languageParam)
    if (params.get('deaf') === '1') setDeafMode(true)
    try {
      const savedVoice = localStorage.getItem('vp_voice_output')
      const savedSettings = localStorage.getItem('vp_settings')
      if (savedVoice !== null) {
        setVoiceOutput(savedVoice === '1')
      } else if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        if (typeof parsed.sound === 'boolean') setVoiceOutput(parsed.sound)
      }
    } catch {
      setVoiceOutput(true)
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }
    syncSupabaseAuthRefreshWithNetwork(getNetworkOnline())
    migrateLocalHistoryToSupabase()
    flushPendingHistorySync()
    searchOffline('newton photosynthesis acid trigonometry', { limit: 1 }).catch(() => {
      // Offline cache warm-up is best-effort for live demos.
    })
    refreshOfflineHealth()
    if (seededSession) {
      setHistoryLoading(true)
      setActiveChatSessionId(seededSession)
      fetchChatMessages(seededSession)
        .then(rows => {
          const restored: Message[] = rows
            .filter(row => row.role === 'user' || row.role === 'assistant')
            .map(row => ({
              id: row.id,
              role: row.role === 'user' ? 'user' : 'ai',
              text: row.content,
              diagram: row.diagram,
              animationKey: (row.metadata?.animationKey as AnimationKey | undefined) || null,
              emotion: (row.emotion as EmotionState) || null,
              pwnMessage: row.metadata?.pwnMessage as string | undefined,
              graphPath: row.graph_path || undefined,
              grounding: row.metadata?.grounding as Message['grounding'],
              outputMode: (row.metadata?.outputMode as OutputMode | undefined) || undefined,
              studyQuestion: row.metadata?.studyQuestion as string | undefined,
              studyConceptHint: row.metadata?.studyConceptHint as string | undefined,
            }))
          setMessages(restored)
        })
        .finally(() => setHistoryLoading(false))
    }
    const unsubscribeNetwork = subscribeNetworkChanges(online => {
      setIsOnline(online)
      syncSupabaseAuthRefreshWithNetwork(online)
      if (online) flushPendingHistorySync()
      refreshOfflineHealth()
    })
    return () => {
      unsubscribeNetwork()
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('vp_voice_output', voiceOutput ? '1' : '0')
      const savedSettings = localStorage.getItem('vp_settings')
      const settings = savedSettings ? JSON.parse(savedSettings) : {}
      localStorage.setItem('vp_settings', JSON.stringify({ ...settings, sound: voiceOutput }))
    } catch {
      // Voice preference is local convenience only.
    }
    if (!voiceOutput && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [voiceOutput])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function startRecording() {
    if (!isOnline) {
      setInput('Offline AI Mode এ voice STT cloud feature বন্ধ। Text question লিখে পাঠাও।')
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.lang = 'bn-BD'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onresult = async (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript
        if (transcript) await sendMessage(transcript)
      }
      recognition.onerror = () => setInput('Voice dhora jayni. Type kore pathao, ba abar mic chapo.')
      recognition.onend = () => setIsRecording(false)
      recognitionRef.current = recognition
      recognition.start()
      setIsRecording(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = event => chunksRef.current.push(event.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        await transcribeAudio(blob)
      }
      recorder.start()
      mediaRef.current = recorder
      setIsRecording(true)
    } catch {
      setInput('Microphone permission lagbe. Type koreo question pathate paro.')
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop?.()
    mediaRef.current?.stop()
    setIsRecording(false)
  }

  async function transcribeAudio(blob: Blob) {
    setIsLoading(true)
    try {
      const form = new FormData()
      form.append('audio', blob, 'question.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (data.text) await sendMessage(data.text)
    } catch {
      setInput('Voice transcription failed. Please type the question.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleImage(file?: File) {
    if (!file) return
    if (!isOnline) {
      setShowOcrReview(true)
      setOcrError('Offline AI Mode এ Gemini Vision OCR বন্ধ। Text manually লিখে question করো।')
      return
    }
    setIsOcrLoading(true)
    setShowOcrReview(true)
    setOcrError('')
    setOcrText('')
    setOcrQuestion('')
    try {
      const optimizedFile = await optimizeImageForOcr(file)
      const form = new FormData()
      form.append('image', optimizedFile)
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      const data = (await res.json()) as OcrResult
      if (data.success && data.text) {
        setOcrText(data.text)
        setOcrError('')
        return
      }
      setOcrError(data.error || 'Text clearly extract kora jayni. Please extracted text manually edit kore question korun.')
    } catch {
      setOcrError('Text clearly extract kora jayni. Please extracted text manually edit kore question korun.')
    } finally {
      setIsOcrLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function askWithOcrContext() {
    const text = ocrText.trim()
    if (!text) {
      setOcrError(t('learn.ocrNeedText'))
      return
    }
    const question = ocrQuestion.trim()
    if (!question) {
      setOcrError(t('learn.ocrNeedQuestion'))
      return
    }
    setShowOcrReview(false)
    setOcrError('')
    await sendMessage(question, { extractedText: text, source: 'ocr' })
  }

  function clearOcrReview() {
    setOcrText('')
    setOcrQuestion('')
    setOcrError('')
    setShowOcrReview(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const isOcrManualMode = /quota|rate limit|try again later|paste\/type|api key|model/i.test(ocrError)

  async function logPeerWisdom(question: string, graphPath?: string[], emotionState?: EmotionState) {
    try {
      await fetch('/api/pwn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, subject, sessionId: getSessionId(), graphPath, emotion: emotionState }),
      })
    } catch {
      // Community logging is helpful, not required for answering.
    }
  }

  async function storeQuestionEmbedding(params: {
    question: string
    answer: string
    graphPath?: string[]
  }) {
    try {
      const res = await fetch('/api/curriculum-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: params.question,
          answer: params.answer,
          subject,
          graphPath: params.graphPath,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.warn('[VectorRAG] Student question embedding was not stored:', data)
        return
      }
      console.info('[VectorRAG] Student question embedding stored in curriculum_embeddings:', data.row)
    } catch (err) {
      console.warn('[VectorRAG] Failed to store student question embedding:', err)
    }
  }

  async function storeQuestionGraph(params: {
    question: string
    answer: string
    graphPath?: string[]
    source?: string
  }) {
    try {
      const res = await fetch('/api/graph-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: params.question,
          answer: params.answer,
          subject,
          graphPath: params.graphPath,
          source: params.source,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.skipped) {
        console.info('[GraphDB] Neo4j graph write skipped:', data.reason)
        return
      }
      if (!res.ok) {
        console.warn('[GraphDB] Question graph was not stored:', data)
        return
      }
      console.info('[GraphDB] Question graph stored in Neo4j:', data)
    } catch (err) {
      console.warn('[GraphDB] Failed to store question graph:', err)
    }
  }

  async function sendMessage(text?: string, context?: { extractedText?: string; source?: 'ocr' }) {
    const question = (text ?? input).trim()
    if (!question || isLoading) return
    const repeatCount = questionHistory.filter(item => item.toLowerCase() === question.toLowerCase()).length
    const localEmotion = localEmotionHint(question, repeatCount)
    setEmotion(localEmotion)
    setQuestionHistory(prev => [...prev, question].slice(-8))
    setInput('')

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: question }
    const loadingMsg: Message = { id: crypto.randomUUID(), role: 'ai', text: '', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setIsLoading(true)
    let cloudSessionId = activeChatSessionId
    if (!cloudSessionId && isOnline) {
      const session = await createChatSession({ firstQuestion: question, subject, outputMode })
      cloudSessionId = session?.id || null
      if (cloudSessionId) setActiveChatSessionId(cloudSessionId)
    }

    if (!isOnline) {
      recordOfflineLearningEvent('offline_question_asked', { subject, outputMode, language })
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            subject,
            outputMode,
            language,
            offlineMode: true,
            classLevel: '9',
          }),
        })
        const data = await res.json()
        const answerText = data.answer || data.answerText || 'Ollama চালু নেই. Terminal এ `ollama run qwen2.5:0.5b` চালাও।'
        setMessages(prev => prev.map(msg =>
          msg.id === loadingMsg.id
            ? {
                ...msg,
                text: answerText,
                diagram: outputMode === 'whiteboard' ? data.diagram : null,
                emotion: localEmotion,
                graphPath: data.graphPath,
                outputMode,
                pwnMessage: data.pwnMessage,
                grounding: data.grounding,
                offline: true,
                provider: data.provider || 'ollama',
                model: data.model || 'qwen2.5:0.5b',
                embeddingModel: data.embeddingModel || 'embeddinggemma:300m-qat-q4_0',
                loading: false,
              }
            : msg
        ))
        recordOfflineLearningEvent('offline_answer_generated', { subject, usedContext: Boolean(data.usedContext), provider: data.provider || 'ollama' })
        if (voiceOutput) {
          speakText(answerText, localEmotion)
          recordOfflineLearningEvent('offline_tts_played', { subject, provider: data.provider || 'ollama' })
        }
        recordPractice(subject, question)
        const offlineHistory = {
          question,
          answer: answerText,
          subject,
          outputMode,
          language,
          source: data.source || 'ollama-offline-curriculum',
          graphPath: data.graphPath,
        }
        recordOfflineChat(offlineHistory)
        queuePendingHistorySync(offlineHistory)
      } catch {
        const [offlineResult] = await searchOffline(question, { limit: 1 })
        const offline = buildOfflineAnswer(offlineResult, question)
        setMessages(prev => prev.map(msg =>
          msg.id === loadingMsg.id
            ? {
                ...msg,
                text: offline.answer,
                diagram: outputMode === 'whiteboard' ? offline.diagram : null,
                emotion: localEmotion,
                graphPath: offline.graphPath,
                outputMode,
                pwnMessage: 'Offline Mode: using locally cached curriculum.',
                offline: true,
                provider: 'local-pack',
                loading: false,
              }
            : msg
        ))
        if (voiceOutput) speakText(offline.answer, localEmotion)
        recordPractice(subject, question)
        const offlineHistory = {
          question,
          answer: offline.answer,
          subject,
          outputMode,
          language,
          source: 'offline-pack',
          graphPath: offline.graphPath,
        }
        recordOfflineChat(offlineHistory)
        queuePendingHistorySync(offlineHistory)
      }
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const studentProfile = getStudentProfile()
      const chatContext = recentChatContext(messages)
      const anchor = followUpAnchor(messages)
      const retrievalQuery = context?.extractedText
        ? `${question}\n\nUploaded text:\n${context.extractedText.slice(0, 1400)}`
        : [question, anchor].filter(Boolean).join('\n\n')
      const curriculumChunks = await searchCurriculum(retrievalQuery, supabase, 0.42, 6, {
        subject,
        profile: studentProfile,
      })
      console.info('[VectorRAG] Sending to Gemini with curriculum context:', curriculumChunks)

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          subject,
          outputMode,
          emotion: localEmotion,
          language,
          uiLanguage,
          selected_target_language: LANGUAGE_LABEL_BY_CODE[language],
          repeatCount,
          studentProfile,
          chatContext,
          conceptMemory: getConceptMemory().slice(0, 6),
          curriculumChunks,
          extractedText: context?.extractedText,
          source: context?.source,
        }),
      })
      const data = await res.json()
      const nextEmotion = (data.detectedEmotion ?? localEmotion) as EmotionState
      const answerText = data.answer || 'দুঃখিত, উত্তর পাওয়া যায়নি। আবার চেষ্টা করো।'
      const answerAnimationKey = isVisualMode(outputMode) ? data.animationKey : null
      setEmotion(nextEmotion)
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? {
              ...msg,
              text: answerText,
              diagram: data.diagram,
              animationKey: answerAnimationKey,
              emotion: nextEmotion,
              targetLanguage: data.selectedTargetLanguage || LANGUAGE_LABEL_BY_CODE[language],
              requestedTargetLanguage: data.requestedTargetLanguage,
              languageConfidence: data.languageConfidence,
              outputScript: data.outputScript,
              answerProvenance: data.languageMetadata?.provenance,
              languageFallback: Boolean(data.languageMetadata?.fallback),
              verified: data.languageMetadata?.verified,
              pwnMessage: data.pwnMessage,
              graphPath: data.graphPath,
              grounding: data.grounding,
              offline: Boolean(data.offline),
              provider: data.provider,
              model: data.model,
              embeddingModel: data.embeddingModel,
              outputMode,
              studyQuestion: nextEmotion === 'confused' || nextEmotion === 'frustrated' ? question : undefined,
              studyConceptHint: Array.isArray(data.graphPath) ? data.graphPath.slice(-1)[0] : undefined,
              loading: false,
            }
          : msg
      ))
      if (data.offline) {
        recordOfflineLearningEvent('offline_answer_generated', { subject, usedContext: Boolean(data.usedContext), provider: data.provider || 'ollama' })
      }
      if (data.answer && voiceOutput) {
        speakText(data.answer, nextEmotion)
        if (data.offline) recordOfflineLearningEvent('offline_tts_played', { subject, provider: data.provider || 'ollama' })
      }
      const savedToCloud = await appendChatMessages(cloudSessionId, [
        { role: 'user', content: question },
        {
          role: 'assistant',
          content: answerText,
          emotion: nextEmotion,
          diagram: data.diagram,
          graphPath: data.graphPath,
          metadata: {
            subject,
            outputMode,
            language,
            source: data.source,
            offline: Boolean(data.offline),
            provider: data.provider,
            model: data.model,
            mode: data.mode,
            inputSource: context?.source,
            hasExtractedText: Boolean(context?.extractedText),
            pwnMessage: data.pwnMessage,
            animationKey: answerAnimationKey,
            grounding: data.grounding,
            studyQuestion: nextEmotion === 'confused' || nextEmotion === 'frustrated' ? question : undefined,
            studyConceptHint: Array.isArray(data.graphPath) ? data.graphPath.slice(-1)[0] : undefined,
          },
        },
      ])
      recordPractice(subject, question)
      recordConceptMemory(question, subject, data.graphPath)
      storeQuestionEmbedding({
        question,
        answer: answerText,
        graphPath: data.graphPath,
      })
      storeQuestionGraph({
        question,
        answer: answerText,
        graphPath: data.graphPath,
        source: data.source,
      })
      if (!savedToCloud) recordChatHistory({
        question,
        answer: answerText,
        subject,
        outputMode,
        language,
        graphPath: data.graphPath,
        source: data.source,
      })
      logPeerWisdom(question, data.graphPath, nextEmotion)
    } catch {
      const errorAnswer = 'দুঃখিত, সার্ভারে সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করো।'
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? { ...msg, text: errorAnswer, loading: false }
          : msg
      ))
      recordOfflineChat({
        question,
        answer: errorAnswer,
        subject,
        outputMode,
        language,
        source: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ai-shell flex h-dvh overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel flex items-center justify-between gap-3 border-x-0 border-t-0 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-2xl border border-white/60 bg-white/70 p-2.5 shadow-sm shadow-forest/5 hover:scale-105 hover:bg-white" aria-label="Open menu">
              <span className="mb-1 block h-0.5 w-5 rounded bg-forest" />
              <span className="block h-0.5 w-3 rounded bg-indigo/70" />
            </button>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold leading-tight">Voice<span className="bg-gradient-to-r from-forest to-indigo bg-clip-text text-transparent">Pandita</span></div>
              <div className="truncate text-[11px] text-ink/45">AI tutor studio for calm learning</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex max-w-[9rem] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold sm:max-w-none sm:px-3 ${
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-orange-200 bg-orange-50 text-orange-700'
            }`}>
              <span>{isOnline ? '● Online' : '● Offline'}</span>
              {!isOnline && <span className="hidden sm:inline">Learning Mode</span>}
            </span>
            {OFFLINE_AI_ENABLED && (
              <span className="hidden items-center gap-1.5 rounded-full border border-indigo/15 bg-indigo/8 px-3 py-1.5 text-xs font-semibold text-indigo sm:inline-flex">
                <WifiOff size={13} /> Offline AI Mode
              </span>
            )}
            {OFFLINE_AI_ENABLED && (
              <span className="hidden rounded-full border border-forest/15 bg-forest/8 px-3 py-1.5 text-xs font-semibold text-forest md:inline-flex">
                {offlineHealth?.model || 'qwen2.5:0.5b'}
              </span>
            )}
            {!isOnline && <WifiOff size={16} className="text-clay" />}
            {emotion && <EmotionBadge emotion={emotion} />}
            <LanguageSwitcher compact />
            <button
              onClick={() => setVoiceOutput(prev => !prev)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                voiceOutput
                  ? 'border-forest/25 bg-forest/10 text-forest'
                  : 'border-white/60 bg-white/65 text-ink/50 hover:text-ink/70'
              }`}
              aria-pressed={voiceOutput}
              aria-label={voiceOutput ? 'Turn voice output off' : 'Turn voice output on'}
            >
              {voiceOutput ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {voiceOutput ? t('learn.voiceOn') : t('learn.voiceOff')}
            </button>
            <SubjectSelector value={subject} onChange={setSubject} />
          </div>
        </header>

        <div className="glass-panel space-y-2 border-x-0 border-t-0 px-4 py-3">
          <OutputModeSelector value={outputMode} onChange={setOutputMode} />
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {[
              ['bn', 'Bangla'],
              ['ckm', 'Chakma'],
              ['mrm', 'Marma'],
              ['gnk', 'Garo'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setLanguage(value as LanguageMode)}
                className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                  language === value ? 'border-forest bg-gradient-to-r from-forest to-indigo text-white shadow-sm shadow-forest/15' : 'border-white/60 bg-white/65 text-ink/60 hover:border-forest/25 hover:bg-white hover:text-ink/75'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setDeafMode(prev => !prev)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                deafMode ? 'border-indigo bg-indigo text-white' : 'border-white/60 bg-white/65 text-ink/60 hover:border-indigo/25 hover:bg-white'
              }`}
            >
              <Accessibility size={12} /> BdSL
            </button>
            <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-saffron/10 px-3 py-1.5 text-xs font-medium text-saffron">
              <Globe size={12} /> Preference {LANGUAGE_LABEL_BY_CODE[language]}
            </span>
          </div>
        </div>

        {!isOnline && (
          <div className="offline-banner flex items-center justify-center gap-2">
            <WifiOff size={14} /> Offline AI Mode active - text question, short explanation, browser TTS, and local progress queue stay available.
          </div>
        )}

        {OFFLINE_AI_ENABLED && offlineHealth && !offlineHealth.ok && (
          <div className="offline-banner flex items-center justify-center gap-2 bg-clay/10 text-clay">
            <WifiOff size={14} /> {offlineHealth.error || 'Ollama চালু নেই. Terminal এ `ollama run qwen2.5:0.5b` চালাও।'}
          </div>
        )}

        <main className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {historyLoading && (
            <div className="mx-auto max-w-3xl space-y-3">
              <div className="skeleton h-20 rounded-2xl" />
              <div className="skeleton h-36 rounded-2xl" />
            </div>
          )}

          {!historyLoading && messages.length === 0 && (
            <div className="flex min-h-full flex-col items-center justify-center py-12 text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-forest via-indigo to-aqua shadow-2xl shadow-forest/25">
                <Mic size={32} className="text-white" />
              </div>
              <h1 className="bangla mb-2 font-display text-2xl font-bold">{t('learn.title')}</h1>
              <p className="bangla max-w-md text-sm leading-relaxed text-ink/55">
                {t('learn.subtitle')}
              </p>
              <div className="mt-5 grid max-w-2xl grid-cols-2 gap-2 text-left text-xs text-ink/60 md:grid-cols-4">
                {['GraphRAG NCTB', 'ONNX emotion stub', 'MELD bridge', 'PWN hotspot'].map(item => (
                  <div key={item} className="rounded-2xl border border-white/60 bg-white/65 px-3 py-2 shadow-sm shadow-forest/5 backdrop-blur-xl">{item}</div>
                ))}
              </div>
              <div className="mt-7 flex max-w-2xl flex-wrap justify-center gap-2">
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)} className="bangla rounded-full border border-white/60 bg-white/75 px-4 py-2 text-xs shadow-sm shadow-forest/5 hover:-translate-y-0.5 hover:border-forest/30 hover:bg-white">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="bangla max-w-[84%] rounded-[1.4rem] rounded-br-md bg-gradient-to-br from-forest to-indigo px-5 py-3 leading-relaxed text-white shadow-xl shadow-forest/20">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[94%] space-y-3 md:max-w-[76%]">
                    {msg.loading ? (
                      <div className="card space-y-3 p-5">
                        <div className="flex items-center gap-2 text-xs text-ink/50">
                          <Loader2 size={14} className="animate-spin" /> TutorAgent traversing NCTB graph...
                        </div>
                        <div className="skeleton h-4 w-3/4" />
                        <div className="skeleton h-4 w-full" />
                        <div className="skeleton h-4 w-2/3" />
                      </div>
                    ) : (
                      <>
                        <div className="card p-5">
                          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-forest/10 pb-3">
                            {msg.emotion && <EmotionBadge emotion={msg.emotion} small />}
                            {msg.targetLanguage && (
                              <span className="rounded-full bg-saffron/10 px-2.5 py-0.5 text-xs font-medium text-saffron">
                                {answerOutputLabel(msg)}
                              </span>
                            )}
                            {typeof msg.languageConfidence === 'number' && (
                              <span className="rounded-full bg-indigo/8 px-2.5 py-0.5 text-xs text-indigo">
                                confidence {Math.round(msg.languageConfidence * 100)}%
                              </span>
                            )}
                            {msg.answerProvenance && (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs ${
                                msg.answerProvenance === 'fallback'
                                  ? 'bg-clay/10 text-clay'
                                  : msg.verified
                                    ? 'bg-forest/8 text-forest'
                                    : 'bg-ink/5 text-ink/55'
                              }`}>
                                {msg.answerProvenance}{msg.verified ? ' verified' : ''}
                              </span>
                            )}
                            {msg.graphPath && (
                              <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                                {msg.graphPath.join(' -> ')}
                              </span>
                            )}
                            {msg.grounding?.grounded && (
                              <span className="rounded-full bg-indigo/10 px-3 py-1 text-xs font-semibold text-indigo">
                                {msg.grounding.label || 'Curriculum grounded'}
                              </span>
                            )}
                            {msg.pwnMessage && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-saffron/20 px-3 py-1 text-xs font-medium text-orange-600">
                                <Sparkles size={12} /> {msg.pwnMessage}
                              </span>
                            )}
                          </div>
                          {msg.languageFallback && (
                            <p className="bangla mb-3 rounded-lg bg-clay/8 px-3 py-2 text-xs leading-relaxed text-clay">
                              {LOW_RESOURCE_FALLBACK_MESSAGE}
                            </p>
                          )}
                          {!msg.languageFallback && usesRomanizedLowResourceOutput(msg) && (
                            <p className="bangla mb-3 rounded-lg bg-indigo/8 px-3 py-2 text-xs leading-relaxed text-indigo">
                              {EXPERIMENTAL_VOICE_MESSAGE}
                            </p>
                          )}
                          {msg.offline && (
                            <div className="bangla mb-3 space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                              <p>Offline lightweight model চলছে, তাই answer সংক্ষিপ্ত। Internet এলে full AI explanation পাওয়া যাবে।</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold">provider {msg.provider || 'ollama'}</span>
                                {msg.model && <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold">{msg.model}</span>}
                              </div>
                            </div>
                          )}
                          <FormattedAnswer text={msg.text} />
                        </div>
                        {((msg.outputMode === 'video' && msg.animationKey) || msg.animationKey || msg.diagram) && (
                          <div className="card p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-forest">
                              <Zap size={12} />
                              <span>
                                {msg.outputMode === 'video'
                                  ? 'Manim Video Explainer'
                                  : msg.animationKey
                                    ? t('learn.visualAnimation')
                                    : t('learn.whiteboardMap')}
                              </span>
                            </div>
                            {msg.outputMode === 'video' && msg.animationKey ? (
                              <ManimVideoAnimation animationKey={msg.animationKey} />
                            ) : msg.animationKey ? (
                              <TeachingAnimation animationKey={msg.animationKey} question={msg.text} graphPath={msg.graphPath} fallbackDiagram={msg.diagram} />
                            ) : (
                              msg.diagram && <MermaidDiagram chart={localizeWhiteboardDiagram(msg.diagram, uiLanguage)} />
                            )}
                          </div>
                        )}
                        <BdslAvatar active={deafMode} text={msg.text} />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (msg.offline) {
                                recordOfflineLearningEvent('offline_bujhi_nai_clicked', {
                                  subject,
                                  model: msg.model,
                                  conceptHint: msg.studyConceptHint || msg.graphPath?.slice(-1)[0],
                                })
                              }
                              setManualStudyInvite({
                                messageId: msg.id,
                                questionText: msg.studyQuestion || messages.slice().reverse().find(item => item.role === 'user')?.text || msg.text.slice(0, 160),
                                conceptHint: msg.studyConceptHint || msg.graphPath?.slice(-1)[0],
                              })
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-3 py-2 text-xs font-semibold text-forest shadow-sm hover:bg-white"
                          >
                            <ThumbsDown size={13} />
                            Bujhi Nai
                          </button>
                        </div>
                        {(msg.studyQuestion || manualStudyInvite?.messageId === msg.id) && (
                          <StudyBuddyInviteCard
                            questionText={manualStudyInvite?.messageId === msg.id ? manualStudyInvite.questionText : msg.studyQuestion || msg.text.slice(0, 160)}
                            subject={subject}
                            language={language === 'bn' ? 'bn' : language === 'ckm' ? 'chakma' : language === 'mrm' ? 'marma' : 'garo'}
                            emotionLabel={msg.emotion === 'frustrated' ? 'frustrated' : 'confused'}
                            conceptHint={manualStudyInvite?.messageId === msg.id ? manualStudyInvite.conceptHint : msg.studyConceptHint || msg.graphPath?.slice(-1)[0]}
                            anonymousSessionId={getSessionId()}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </main>

        <div className="glass-panel border-x-0 border-b-0 px-4 pb-4 pb-safe pt-3">
          {showOcrReview && (
            <div className="mx-auto mb-3 max-w-3xl rounded-2xl border border-forest/15 bg-white/80 p-3 shadow-lg shadow-forest/5 backdrop-blur-xl">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <FileText size={16} className="text-forest" />
                  <span>{isOcrLoading ? t('learn.extracting') : t('learn.reviewExtracted')}</span>
                </div>
                {!isOcrLoading && ocrText && (
                  <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                    {t('learn.ocrBadge')}
                  </span>
                )}
              </div>

              {isOcrLoading ? (
                <div className="flex items-center gap-2 rounded-xl bg-paper/70 px-3 py-3 text-sm text-ink/60">
                  <Loader2 size={16} className="animate-spin text-forest" />
                  <span>{t('learn.ocrLoading')}</span>
                </div>
              ) : (
                <>
                  {ocrError && (
                    <p className={`mb-2 rounded-xl px-3 py-2 text-sm ${isOcrManualMode ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
                      {ocrError}
                    </p>
                  )}
                  <textarea
                    value={ocrText}
                    onChange={e => {
                      setOcrText(e.target.value)
                      if (e.target.value.trim()) setOcrError('')
                    }}
                    placeholder={t('learn.ocrTextPlaceholder')}
                    className="bangla min-h-24 w-full resize-y rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
                  />
                  <textarea
                    value={ocrQuestion}
                    onChange={e => setOcrQuestion(e.target.value)}
                    placeholder={t('learn.ocrQuestionPlaceholder')}
                    className="mt-2 min-h-16 w-full resize-y rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={askWithOcrContext}
                      disabled={!ocrQuestion.trim() || isLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-forest to-indigo px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                    >
                      <Send size={14} /> {t('learn.askVoicePandita')}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={isOcrLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-4 py-2 text-sm font-semibold text-forest shadow-sm hover:bg-white"
                    >
                      <RotateCcw size={14} /> {t('learn.uploadAgain')}
                    </button>
                    <button
                      type="button"
                      onClick={clearOcrReview}
                      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/60 px-4 py-2 text-sm font-semibold text-ink/60 shadow-sm hover:bg-white"
                    >
                      <Trash2 size={14} /> {t('common.clear')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                isRecording
                  ? 'mic-recording scale-105 bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/25'
                  : 'border border-white/60 bg-white/75 text-ink/60 shadow-sm hover:border-forest/35 hover:text-forest'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              title={!isOnline ? 'Offline mode: type your question' : 'Start recording'}
            >
              {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => handleImage(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isOcrLoading || !isOnline}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center gap-2 rounded-full border border-white/60 bg-white/75 text-ink/60 shadow-sm hover:border-forest/35 hover:text-forest disabled:opacity-50 sm:w-auto sm:px-4"
              aria-label="Scan or upload question image"
              title={!isOnline ? 'Offline mode: OCR needs cloud vision' : 'Scan or upload image'}
            >
              {isOcrLoading ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />}
              <span className="hidden text-sm font-semibold sm:inline">{t('learn.scanImage')}</span>
            </button>

            <a
              href="/pdf-summary"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center gap-2 rounded-full border border-white/60 bg-white/75 text-ink/60 shadow-sm hover:border-forest/35 hover:text-forest sm:w-auto sm:px-4"
              aria-label="Open PDF summary"
              title={t('learn.pdfSummary')}
            >
              <FileText size={18} />
              <span className="hidden text-sm font-semibold sm:inline">{t('learn.pdfSummary')}</span>
            </a>

            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={t('learn.inputPlaceholder')}
                className="bangla w-full resize-none rounded-[1.35rem] border border-white/70 bg-white/85 px-4 py-3 pr-12 text-sm leading-relaxed shadow-lg shadow-forest/5 backdrop-blur-xl focus:border-forest/35 focus:outline-none"
                rows={1}
                style={{ minHeight: 48, maxHeight: 160 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-forest to-indigo text-white shadow-sm hover:scale-105 disabled:opacity-30"
                aria-label="Send question"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
