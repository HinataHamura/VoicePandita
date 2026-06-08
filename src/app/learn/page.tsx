'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Accessibility, Camera, FileText, Globe, Loader2, Mic, MicOff, RotateCcw, Send, Sparkles, ThumbsDown, Trash2, Volume2, VolumeX, WifiOff, Zap } from 'lucide-react'
import BdslAvatar from '@/components/BdslAvatar'
import EmotionBadge from '@/components/EmotionBadge'
import MermaidDiagram from '@/components/MermaidDiagram'
import OutputModeSelector from '@/components/OutputModeSelector'
import Sidebar from '@/components/Sidebar'
import SubjectSelector from '@/components/SubjectSelector'
import StudyBuddyInviteCard from '@/components/study-buddy/StudyBuddyInviteCard'
import ManimVideoAnimation from '@/components/animations/ManimVideoAnimation'
import TeachingAnimation from '@/components/animations/TeachingAnimation'
import type { AnimationKey } from '@/components/animations/types'
import { getAuthenticatedStudent } from '@/lib/authFlow'
import { getConceptMemory, getStudentProfile, recordChatHistory, recordConceptMemory, recordPractice } from '@/lib/studentStore'
import { searchCurriculum } from '@/lib/embeddings'
import { createClient } from '@/lib/supabase/client'
import { appendChatMessages, createChatSession, fetchChatMessages, migrateLocalHistoryToSupabase, recordOfflineChat } from '@/lib/services/chatHistory'

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
  grounding?: {
    grounded: boolean
    label?: string
    sourceDataset?: string | null
    similarity?: number | null
  }
  loading?: boolean
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

  useEffect(() => {
    getAuthenticatedStudent().then(student => {
      if (!student) {
        window.location.replace('/login?next=/learn')
      }
    })
    setIsOnline(navigator.onLine)
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
    migrateLocalHistoryToSupabase()
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
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
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
      setOcrError('Extracted text ta review/edit kore then ask korun.')
      return
    }
    const question = ocrQuestion.trim()
    if (!question) {
      setOcrError('Extracted text niye ki jante chao, question field-e likho.')
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
    if (!cloudSessionId && navigator.onLine) {
      const session = await createChatSession({ firstQuestion: question, subject, outputMode })
      cloudSessionId = session?.id || null
      if (cloudSessionId) setActiveChatSessionId(cloudSessionId)
    }

    if (!navigator.onLine) {
      const offline = OFFLINE_ANSWERS[subject] || OFFLINE_ANSWERS.physics
      const offlineAnswer = `${offline} Online হলে GraphRAG + Gemini দিয়ে আরও বিস্তারিত visual explanation দেব।`
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? { ...msg, text: offlineAnswer, emotion: localEmotion, loading: false }
          : msg
      ))
      recordPractice(subject, question)
      recordOfflineChat({
        question,
        answer: offlineAnswer,
        subject,
        outputMode,
        language,
        source: 'offline-pack',
      })
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
              outputMode,
              studyQuestion: nextEmotion === 'confused' || nextEmotion === 'frustrated' ? question : undefined,
              studyConceptHint: Array.isArray(data.graphPath) ? data.graphPath.slice(-1)[0] : undefined,
              loading: false,
            }
          : msg
      ))
      if (data.answer && voiceOutput) speakText(data.answer, nextEmotion)
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
            {!isOnline && <WifiOff size={16} className="text-clay" />}
            {emotion && <EmotionBadge emotion={emotion} />}
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
              Voice {voiceOutput ? 'On' : 'Off'}
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
            <WifiOff size={14} /> Offline pack active - cached answers are available.
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
              <h1 className="bangla mb-2 font-display text-2xl font-bold">কী জানতে চাও?</h1>
              <p className="bangla max-w-md text-sm leading-relaxed text-ink/55">
                Bangla voice, typed question, textbook photo, mother-tongue mode, emotion adaptation, and BdSL avatar - এক জায়গায়।
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
                          <p className="bangla whitespace-pre-line leading-relaxed text-ink">{msg.text}</p>
                        </div>
                        {((msg.outputMode === 'video' && msg.animationKey) || msg.animationKey || msg.diagram) && (
                          <div className="card p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-forest">
                              <Zap size={12} />
                              <span>
                                {msg.outputMode === 'video'
                                  ? 'Manim Video Explainer'
                                  : msg.animationKey
                                    ? 'Visual Teaching Animation'
                                    : 'Whiteboard Concept Map'}
                              </span>
                            </div>
                            {msg.outputMode === 'video' && msg.animationKey ? (
                              <ManimVideoAnimation animationKey={msg.animationKey} />
                            ) : msg.animationKey ? (
                              <TeachingAnimation animationKey={msg.animationKey} question={msg.text} graphPath={msg.graphPath} fallbackDiagram={msg.diagram} />
                            ) : (
                              msg.diagram && <MermaidDiagram chart={msg.diagram} />
                            )}
                          </div>
                        )}
                        <BdslAvatar active={deafMode} text={msg.text} />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setManualStudyInvite({
                              messageId: msg.id,
                              questionText: msg.studyQuestion || messages.slice().reverse().find(item => item.role === 'user')?.text || msg.text.slice(0, 160),
                              conceptHint: msg.studyConceptHint || msg.graphPath?.slice(-1)[0],
                            })}
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
                  <span>{isOcrLoading ? 'Extracting text...' : 'Review extracted text'}</span>
                </div>
                {!isOcrLoading && ocrText && (
                  <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                    OCR extracted - please review
                  </span>
                )}
              </div>

              {isOcrLoading ? (
                <div className="flex items-center gap-2 rounded-xl bg-paper/70 px-3 py-3 text-sm text-ink/60">
                  <Loader2 size={16} className="animate-spin text-forest" />
                  <span>Extracting readable text from image...</span>
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
                    placeholder="Extracted educational text ekhane review/edit korun..."
                    className="bangla min-h-24 w-full resize-y rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
                  />
                  <textarea
                    value={ocrQuestion}
                    onChange={e => setOcrQuestion(e.target.value)}
                    placeholder="Ask a question about the extracted text..."
                    className="mt-2 min-h-16 w-full resize-y rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={askWithOcrContext}
                      disabled={!ocrQuestion.trim() || isLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-forest to-indigo px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                    >
                      <Send size={14} /> Ask VoicePandita
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={isOcrLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-4 py-2 text-sm font-semibold text-forest shadow-sm hover:bg-white"
                    >
                      <RotateCcw size={14} /> Upload again
                    </button>
                    <button
                      type="button"
                      onClick={clearOcrReview}
                      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/60 px-4 py-2 text-sm font-semibold text-ink/60 shadow-sm hover:bg-white"
                    >
                      <Trash2 size={14} /> Clear
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
            >
              {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => handleImage(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isOcrLoading}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center gap-2 rounded-full border border-white/60 bg-white/75 text-ink/60 shadow-sm hover:border-forest/35 hover:text-forest disabled:opacity-50 sm:w-auto sm:px-4"
              aria-label="Scan or upload question image"
              title="Scan or upload image"
            >
              {isOcrLoading ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />}
              <span className="hidden text-sm font-semibold sm:inline">Scan / Upload Image</span>
            </button>

            <a
              href="/pdf-summary"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center gap-2 rounded-full border border-white/60 bg-white/75 text-ink/60 shadow-sm hover:border-forest/35 hover:text-forest sm:w-auto sm:px-4"
              aria-label="Open PDF summary"
              title="PDF Summary"
            >
              <FileText size={18} />
              <span className="hidden text-sm font-semibold sm:inline">PDF Summary</span>
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
                placeholder="বাংলায় প্রশ্ন লেখো... Enter চাপলে পাঠাবে"
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
