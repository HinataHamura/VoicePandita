'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Accessibility, Globe, Loader2, Plus, Send, Sparkles, WifiOff, Zap } from 'lucide-react'
import BdslAvatar from '@/components/BdslAvatar'
import EmotionBadge from '@/components/EmotionBadge'
import MermaidDiagram from '@/components/MermaidDiagram'
import OutputModeSelector from '@/components/OutputModeSelector'
import SubjectSelector from '@/components/SubjectSelector'
import { getConceptMemory, recordConceptMemory, recordPractice } from '@/lib/studentStore'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation'
type EmotionState = 'confident' | 'confused' | 'frustrated' | null
type LanguageMode = 'bn' | 'ccp' | 'mrm' | 'gnk'

const LANGUAGE_TABS: { code: LanguageMode; label: string }[] = [
  { code: 'bn', label: 'Bangla' },
  { code: 'ccp', label: 'Chakma' },
  { code: 'mrm', label: 'Marma' },
  { code: 'gnk', label: 'Garo' },
]

const LANGUAGE_LABEL_BY_CODE: Record<LanguageMode, string> = {
  bn: 'Bangla',
  ccp: 'Chakma',
  mrm: 'Marma',
  gnk: 'Garo',
}

interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  diagram?: string | null
  emotion?: EmotionState
  targetLanguage?: string
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
  const [questionHistory, setQuestionHistory] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const params = new URLSearchParams(window.location.search)
    const seededQuestion = params.get('q')
    const mode = params.get('mode') as OutputMode | null
    const languageParam = params.get('language')
    if (seededQuestion) setInput(seededQuestion)
    if (mode && ['whiteboard', 'text', 'exam', 'simple', 'animation'].includes(mode)) setOutputMode(mode)
    if (languageParam && ['bn', 'ccp', 'ckm', 'mrm', 'gnk'].includes(languageParam)) {
      setLanguage((languageParam === 'ckm' ? 'ccp' : languageParam) as LanguageMode)
    }
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

  async function logPeerWisdom(question: string) {
    try {
      await fetch('/api/pwn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, subject, sessionId: getSessionId() }),
      })
    } catch {
      // Community logging is helpful, not required for answering.
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
    const loadingMsg: Message = { id: crypto.randomUUID(), role: 'ai', text: '', targetLanguage: LANGUAGE_LABEL_BY_CODE[language], loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setIsLoading(true)

    if (!navigator.onLine) {
      const offline = OFFLINE_ANSWERS[subject] || OFFLINE_ANSWERS.physics
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? { ...msg, text: `${offline} Online হলে GraphRAG + Gemini দিয়ে আরও বিস্তারিত visual explanation দেব।`, emotion: localEmotion, targetLanguage: LANGUAGE_LABEL_BY_CODE[language], loading: false }
          : msg
      ))
      recordPractice(subject, question)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          subject,
          outputMode,
          emotion: localEmotion,
          language,
          selected_target_language: LANGUAGE_LABEL_BY_CODE[language],
          repeatCount,
          conceptMemory: getConceptMemory().slice(0, 6),
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
              targetLanguage: data.selectedTargetLanguage || LANGUAGE_LABEL_BY_CODE[language],
              pwnMessage: data.pwnMessage,
              graphPath: data.graphPath,
              loading: false,
            }
          : msg
      ))
      recordPractice(subject, question)
      recordConceptMemory(question, subject, data.graphPath)
      logPeerWisdom(question)
    } catch {
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? { ...msg, text: 'দুঃখিত, সার্ভারে সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করো।', loading: false }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  function startNewChat() {
    localStorage.setItem('vp_session_id', crypto.randomUUID())
    setMessages([])
    setInput('')
    setEmotion(null)
    setQuestionHistory([])
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-cream">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-forest/10 bg-cream/82 px-4 py-3 backdrop-blur-xl">
          <div className="ml-16 flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="font-display text-lg font-bold leading-tight">Voice<span className="text-saffron">Pandita</span></div>
              <div className="truncate text-[11px] text-ink/45">SSC/HSC voice-first GraphRAG tutor</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && <WifiOff size={16} className="text-clay" />}
            {emotion && <EmotionBadge emotion={emotion} />}
            <button
              onClick={startNewChat}
              disabled={isLoading && messages.length > 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-forest/10 bg-white/78 px-3 py-1.5 text-xs font-medium text-ink/65 shadow-sm hover:border-saffron/30 hover:text-saffron disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Start new chat"
            >
              <Plus size={13} />
              New chat
            </button>
            <SubjectSelector value={subject} onChange={setSubject} />
          </div>
        </header>

        <div className="space-y-2 border-b border-forest/10 bg-white/45 px-4 py-2 backdrop-blur-xl">
          <OutputModeSelector value={outputMode} onChange={setOutputMode} />
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {LANGUAGE_TABS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                  language === code ? 'border-forest bg-forest text-white shadow-sm shadow-forest/15' : 'border-forest/10 bg-white/80 text-ink/55 hover:border-forest/24 hover:text-ink/75'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setDeafMode(prev => !prev)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                deafMode ? 'border-indigo bg-indigo text-white' : 'border-forest/10 bg-white/80 text-ink/55 hover:border-indigo/25'
              }`}
            >
              <Accessibility size={12} /> BdSL
            </button>
            <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-saffron/10 px-3 py-1.5 text-xs font-medium text-saffron">
              <Globe size={12} /> Answering in {LANGUAGE_LABEL_BY_CODE[language]}
            </span>
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
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-forest to-indigo shadow-xl shadow-forest/20">
                <Globe size={32} className="text-white" />
              </div>
              <h1 className="bangla mb-2 font-display text-2xl font-bold">কী জানতে চাও?</h1>
              <p className="bangla max-w-md text-sm leading-relaxed text-ink/55">
                Bangla, English, Chakma, Marma, or Garo text লিখে প্রশ্ন করো. উত্তর সবসময় selected language tab অনুযায়ী আসবে।
              </p>
              <div className="mt-5 grid max-w-2xl grid-cols-2 gap-2 text-left text-xs text-ink/58 md:grid-cols-4">
                {['GraphRAG NCTB', 'ONNX emotion stub', 'MELD bridge', 'PWN hotspot'].map(item => (
                  <div key={item} className="rounded-lg border border-forest/10 bg-white/72 px-3 py-2 shadow-sm">{item}</div>
                ))}
              </div>
              <div className="mt-7 flex max-w-2xl flex-wrap justify-center gap-2">
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)} className="bangla rounded-full border border-forest/10 bg-white/82 px-4 py-2 text-xs shadow-sm hover:border-saffron/35 hover:bg-saffron/5">
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
                  <div className="bangla max-w-[84%] rounded-2xl rounded-br-md bg-gradient-to-br from-forest to-indigo px-5 py-3 leading-relaxed text-white shadow-lg shadow-forest/15">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[94%] space-y-3 md:max-w-[76%]">
                    {msg.loading ? (
                      <div className="card space-y-3 p-5">
                        <div className="flex items-center gap-2 text-xs text-ink/50">
                          <Loader2 size={14} className="animate-spin" /> TutorAgent answering in {msg.targetLanguage || LANGUAGE_LABEL_BY_CODE[language]}...
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
                                Answering in {msg.targetLanguage}
                              </span>
                            )}
                            {msg.graphPath && (
                              <span className="rounded-full bg-forest/8 px-2.5 py-0.5 text-xs text-forest">
                                {msg.graphPath.join(' -> ')}
                              </span>
                            )}
                            {msg.pwnMessage && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-saffron/10 px-2.5 py-0.5 text-xs text-saffron">
                                <Sparkles size={12} /> {msg.pwnMessage}
                              </span>
                            )}
                          </div>
                          <p className="bangla whitespace-pre-line leading-relaxed text-ink">{msg.text}</p>
                        </div>
                        {msg.diagram && (
                          <div className="card p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-forest">
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

        <div className="border-t border-forest/10 bg-cream/82 px-4 pb-4 pb-safe pt-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
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
                className="bangla w-full resize-none rounded-2xl border border-forest/10 bg-white/92 px-4 py-3 pr-12 text-sm leading-relaxed shadow-sm focus:border-saffron/40 focus:outline-none"
                rows={1}
                style={{ minHeight: 48, maxHeight: 160 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-saffron text-white shadow-sm hover:bg-saffron/90 disabled:opacity-30"
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
