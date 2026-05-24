'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Accessibility, Camera, Loader2, Mic, MicOff, Send, Sparkles, WifiOff, Zap } from 'lucide-react'
import BdslAvatar from '@/components/BdslAvatar'
import EmotionBadge from '@/components/EmotionBadge'
import MermaidDiagram from '@/components/MermaidDiagram'
import OutputModeSelector from '@/components/OutputModeSelector'
import Sidebar from '@/components/Sidebar'
import SubjectSelector from '@/components/SubjectSelector'
import { getAuthenticatedStudent } from '@/lib/authFlow'
import { getConceptMemory, recordChatHistory, recordConceptMemory, recordPractice } from '@/lib/studentStore'
import { searchCurriculum } from '@/lib/embeddings'
import { createClient } from '@/lib/supabase/client'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation'
type EmotionState = 'confident' | 'confused' | 'frustrated' | null
type LanguageMode = 'bn' | 'ckm' | 'mrm' | 'gnk'

interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  diagram?: string | null
  emotion?: EmotionState
  pwnMessage?: string
  graphPath?: string[]
  loading?: boolean
}

const QUICK_QUESTIONS = [
  'Newton-er 2nd law bujhai dao',
  'সালোকসংশ্লেষণ কীভাবে হয়?',
  'আয়নিক বন্ধন সহজ করে বুঝাও',
  'দ্বিঘাত সমীকরণের সূত্র কীভাবে ব্যবহার করব?',
]

const OFFLINE_ANSWERS: Record<string, string> = {
  physics: 'Offline pack: F = ma মানে বল = ভর × ত্বরণ। একই ভরে বেশি বল দিলে ত্বরণ বেশি হয়।',
  chemistry: 'Offline pack: আয়নিক বন্ধনে এক পরমাণু ইলেকট্রন ছাড়ে, অন্যটি নেয়। বিপরীত আধান আকর্ষণ করে বন্ধন বানায়।',
  biology: 'Offline pack: সালোকসংশ্লেষণে উদ্ভিদ আলো, CO2 ও পানি ব্যবহার করে গ্লুকোজ ও অক্সিজেন তৈরি করে।',
  math: 'Offline pack: ax²+bx+c=0 হলে x = (-b ± √(b²-4ac)) / 2a সূত্রে মান বসাও।',
  bangla: 'Offline pack: সৃজনশীল উত্তরে মূল ভাব, ব্যাখ্যা, উদাহরণ - এই তিন ধাপ রাখো।',
  english: 'Offline pack: Start with one short correct sentence, then add details.',
}

function speakText(text: string, emotion?: EmotionState) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'bn-BD'
  utterance.rate = emotion === 'frustrated' ? 0.82 : emotion === 'confused' ? 0.9 : 1
  utterance.pitch = 1
  const banglaVoice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('bn'))
  if (banglaVoice) utterance.voice = banglaVoice
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
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

export default function LearnPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [subject, setSubject] = useState('physics')
  const [outputMode, setOutputMode] = useState<OutputMode>('whiteboard')
  const [language, setLanguage] = useState<LanguageMode>('bn')
  const [emotion, setEmotion] = useState<EmotionState>(null)
  const [deafMode, setDeafMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [questionHistory, setQuestionHistory] = useState<string[]>([])
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
    const mode = params.get('mode') as OutputMode | null
    const languageParam = params.get('language') as LanguageMode | null
    if (seededQuestion) setInput(seededQuestion)
    if (mode && ['whiteboard', 'text', 'exam', 'simple', 'animation'].includes(mode)) setOutputMode(mode)
    if (languageParam && ['bn', 'ckm', 'mrm', 'gnk'].includes(languageParam)) setLanguage(languageParam)
    if (params.get('deaf') === '1') setDeafMode(true)
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

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
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      const data = await res.json()
      if (data.text) {
        setInput(data.text)
        await sendMessage(data.text)
      }
    } catch {
      setInput('ছবির প্রশ্নটি এখানে টাইপ করো। OCR এখন কাজ করছে না।')
    } finally {
      setIsOcrLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function logPeerWisdom(question: string, graphPath?: string[]) {
    try {
      await fetch('/api/pwn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, subject, sessionId: getSessionId(), graphPath }),
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

  async function sendMessage(text?: string) {
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

    if (!navigator.onLine) {
      const offline = OFFLINE_ANSWERS[subject] || OFFLINE_ANSWERS.physics
      const offlineAnswer = `${offline} Online হলে GraphRAG + Gemini দিয়ে আরও বিস্তারিত visual explanation দেব।`
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? { ...msg, text: offlineAnswer, emotion: localEmotion, loading: false }
          : msg
      ))
      recordPractice(subject, question)
      recordChatHistory({
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
      const curriculumChunks = await searchCurriculum(question, supabase, 0.5, 3)
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
          conceptMemory: getConceptMemory().slice(0, 6),
          curriculumChunks,
        }),
      })
      const data = await res.json()
      const nextEmotion = (data.detectedEmotion ?? localEmotion) as EmotionState
      setEmotion(nextEmotion)
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? {
              ...msg,
              text: data.answer || 'দুঃখিত, উত্তর পাওয়া যায়নি। আবার চেষ্টা করো।',
              diagram: data.diagram,
              emotion: nextEmotion,
              pwnMessage: data.pwnMessage,
              graphPath: data.graphPath,
              loading: false,
            }
          : msg
      ))
      if (data.answer) speakText(data.answer, nextEmotion)
      recordPractice(subject, question)
      recordConceptMemory(question, subject, data.graphPath)
      storeQuestionEmbedding({
        question,
        answer: data.answer || '',
        graphPath: data.graphPath,
      })
      storeQuestionGraph({
        question,
        answer: data.answer || '',
        graphPath: data.graphPath,
        source: data.source,
      })
      recordChatHistory({
        question,
        answer: data.answer || 'দুঃখিত, উত্তর পাওয়া যায়নি। আবার চেষ্টা করো।',
        subject,
        outputMode,
        language,
        graphPath: data.graphPath,
        source: data.source,
      })
      logPeerWisdom(question, data.graphPath)
    } catch {
      const errorAnswer = 'দুঃখিত, সার্ভারে সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করো।'
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? { ...msg, text: errorAnswer, loading: false }
          : msg
      ))
      recordChatHistory({
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
            <button onClick={() => setSidebarOpen(true)} className="rounded-2xl border border-white/60 bg-white/72 p-2.5 shadow-sm shadow-forest/5 hover:scale-105 hover:bg-white" aria-label="Open menu">
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
                  language === value ? 'border-forest bg-gradient-to-r from-forest to-indigo text-white shadow-sm shadow-forest/15' : 'border-white/60 bg-white/66 text-ink/55 hover:border-forest/24 hover:bg-white hover:text-ink/75'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setDeafMode(prev => !prev)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                deafMode ? 'border-indigo bg-indigo text-white' : 'border-white/60 bg-white/66 text-ink/55 hover:border-indigo/25 hover:bg-white'
              }`}
            >
              <Accessibility size={12} /> BdSL
            </button>
          </div>
        </div>

        {!isOnline && (
          <div className="offline-banner flex items-center justify-center gap-2">
            <WifiOff size={14} /> Offline pack active - cached answers are available.
          </div>
        )}

        <main className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex min-h-full flex-col items-center justify-center py-12 text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-forest via-indigo to-aqua shadow-2xl shadow-forest/25">
                <Mic size={32} className="text-white" />
              </div>
              <h1 className="bangla mb-2 font-display text-2xl font-bold">কী জানতে চাও?</h1>
              <p className="bangla max-w-md text-sm leading-relaxed text-ink/55">
                Bangla voice, typed question, textbook photo, mother-tongue mode, emotion adaptation, and BdSL avatar - এক জায়গায়।
              </p>
              <div className="mt-5 grid max-w-2xl grid-cols-2 gap-2 text-left text-xs text-ink/58 md:grid-cols-4">
                {['GraphRAG NCTB', 'ONNX emotion stub', 'MELD bridge', 'PWN hotspot'].map(item => (
                  <div key={item} className="rounded-2xl border border-white/60 bg-white/66 px-3 py-2 shadow-sm shadow-forest/5 backdrop-blur-xl">{item}</div>
                ))}
              </div>
              <div className="mt-7 flex max-w-2xl flex-wrap justify-center gap-2">
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)} className="bangla rounded-full border border-white/60 bg-white/76 px-4 py-2 text-xs shadow-sm shadow-forest/5 hover:-translate-y-0.5 hover:border-forest/30 hover:bg-white">
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
                            {msg.graphPath && (
                              <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                                {msg.graphPath.join(' -> ')}
                              </span>
                            )}
                            {msg.pwnMessage && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-saffron/20 px-3 py-1 text-xs font-medium text-orange-600">
                                <Sparkles size={12} /> {msg.pwnMessage}
                              </span>
                            )}
                          </div>
                          <p className="bangla whitespace-pre-line leading-relaxed text-ink">{msg.text}</p>
                        </div>
                        {msg.diagram && (
                          <div className="card p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-forest">
                              <Zap size={12} />
                              <span>Concept Diagram</span>
                            </div>
                            <MermaidDiagram chart={msg.diagram} />
                          </div>
                        )}
                        <BdslAvatar active={deafMode} text={msg.text} />
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
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                isRecording
                  ? 'mic-recording scale-105 bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/25'
                  : 'border border-white/60 bg-white/78 text-ink/60 shadow-sm hover:border-forest/35 hover:text-forest'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isOcrLoading}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/78 text-ink/60 shadow-sm hover:border-forest/35 hover:text-forest disabled:opacity-50"
              aria-label="Upload textbook photo"
            >
              {isOcrLoading ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />}
            </button>

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
                className="bangla w-full resize-none rounded-[1.35rem] border border-white/70 bg-white/84 px-4 py-3 pr-12 text-sm leading-relaxed shadow-lg shadow-forest/5 backdrop-blur-xl focus:border-forest/35 focus:outline-none"
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
