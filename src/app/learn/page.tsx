'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Loader2, Mic, MicOff, Send, Sparkles, WifiOff, Zap } from 'lucide-react'
import EmotionBadge from '@/components/EmotionBadge'
import MermaidDiagram from '@/components/MermaidDiagram'
import OutputModeSelector from '@/components/OutputModeSelector'
import Sidebar from '@/components/Sidebar'
import SubjectSelector from '@/components/SubjectSelector'

type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple'
type EmotionState = 'confident' | 'confused' | 'frustrated' | null
type LanguageMode = 'bn' | 'ckm' | 'mrm' | 'gnk'

interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  diagram?: string | null
  emotion?: EmotionState
  pwnMessage?: string
  loading?: boolean
}

const QUICK_QUESTIONS = [
  'Newton-er 2nd law bujhai dao',
  'সালোকসংশ্লেষণ কীভাবে হয়?',
  'আয়নিক বন্ধন সহজ করে বুঝাও',
  'দ্বিঘাত সমীকরণের সূত্র কিভাবে ব্যবহার করব?',
]

const OFFLINE_ANSWERS: Record<string, string> = {
  physics: 'Offline pack: F = ma মানে বল = ভর × ত্বরণ। একই ভরের বস্তুকে বেশি বল দিলে ত্বরণ বেশি হয়।',
  chemistry: 'Offline pack: আয়নিক বন্ধনে এক পরমাণু ইলেকট্রন ছাড়ে, অন্যটি নেয়। বিপরীত আধান আকর্ষণ করে বন্ধন বানায়।',
  biology: 'Offline pack: সালোকসংশ্লেষণে উদ্ভিদ আলো, CO2 ও পানি ব্যবহার করে গ্লুকোজ ও অক্সিজেন তৈরি করে।',
  math: 'Offline pack: ax²+bx+c=0 হলে x = (-b ± √(b²-4ac)) / 2a সূত্রে মান বসাও।',
  english: 'Offline pack: Start with one short correct sentence, then add details.',
}

function speakText(text: string, emotion?: EmotionState) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'bn-BD'
  utterance.rate = emotion === 'frustrated' ? 0.85 : emotion === 'confused' ? 0.9 : 1
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

export default function LearnPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [subject, setSubject] = useState('physics')
  const [outputMode, setOutputMode] = useState<OutputMode>('whiteboard')
  const [language, setLanguage] = useState<LanguageMode>('bn')
  const [emotion, setEmotion] = useState<EmotionState>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const seededQuestion = new URLSearchParams(window.location.search).get('q')
    if (seededQuestion) setInput(seededQuestion)
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
      alert('Microphone permission is needed for voice questions.')
    }
  }

  function stopRecording() {
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
    setInput('')

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: question }
    const loadingMsg: Message = { id: crypto.randomUUID(), role: 'ai', text: '', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setIsLoading(true)

    if (!navigator.onLine) {
      const offline = OFFLINE_ANSWERS[subject] || OFFLINE_ANSWERS.physics
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? { ...msg, text: `${offline} Online হলে আমি আরও বিস্তারিত visual explanation দেব।`, emotion: 'confident', loading: false }
          : msg
      ))
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, subject, outputMode, emotion, language }),
      })
      const data = await res.json()
      const nextEmotion = (data.detectedEmotion ?? null) as EmotionState
      setEmotion(nextEmotion)
      setMessages(prev => prev.map(msg =>
        msg.id === loadingMsg.id
          ? {
              ...msg,
              text: data.answer || 'দুঃখিত, উত্তর পাওয়া যায়নি। আবার চেষ্টা করো।',
              diagram: data.diagram,
              emotion: nextEmotion,
              pwnMessage: data.pwnMessage,
              loading: false,
            }
          : msg
      ))
      if (data.answer) speakText(data.answer, nextEmotion)
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

  return (
    <div className="flex h-dvh bg-cream overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5 bg-cream/85 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-black/5 rounded-lg transition-colors" aria-label="Open menu">
              <span className="block h-0.5 w-5 bg-ink rounded mb-1" />
              <span className="block h-0.5 w-3 bg-ink/50 rounded" />
            </button>
            <div className="min-w-0">
              <div className="font-display font-bold text-lg leading-tight">Voice<span className="text-saffron">Pandita</span></div>
              <div className="text-[11px] text-ink/45 truncate">Learn. Understand. Belong.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && <WifiOff size={16} className="text-clay" />}
            {emotion && <EmotionBadge emotion={emotion} />}
            <SubjectSelector value={subject} onChange={setSubject} />
          </div>
        </header>

        <div className="px-4 py-2 border-b border-black/5 space-y-2">
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
                  language === value ? 'bg-forest/10 border-forest/30 text-forest font-medium' : 'bg-white border-black/8 text-ink/55'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!isOnline && (
          <div className="offline-banner flex items-center justify-center gap-2">
            <WifiOff size={14} /> Offline pack active - cached answers are available.
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="min-h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 bg-forest/10 rounded-full flex items-center justify-center mb-5">
                <Mic size={32} className="text-forest" />
              </div>
              <h1 className="bangla font-display text-2xl font-bold mb-2">কী জানতে চাও?</h1>
              <p className="bangla text-ink/55 max-w-md text-sm leading-relaxed">
                Bangla voice, typed question, or textbook photo - যেভাবে সুবিধা হয় সেভাবে প্রশ্ন করো।
              </p>
              <div className="mt-7 flex flex-wrap gap-2 justify-center max-w-2xl">
                {QUICK_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="bangla text-xs bg-white border border-black/8 rounded-full px-4 py-2 hover:border-saffron/40 hover:bg-saffron/5 transition-all"
                  >
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
                  <div className="max-w-[84%] bg-forest text-white px-5 py-3 rounded-2xl rounded-br-md bangla leading-relaxed">
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[94%] md:max-w-[76%] space-y-3">
                    {msg.loading ? (
                      <div className="card p-5 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-ink/50">
                          <Loader2 size={14} className="animate-spin" /> TutorAgent thinking...
                        </div>
                        <div className="skeleton h-4 w-3/4" />
                        <div className="skeleton h-4 w-full" />
                        <div className="skeleton h-4 w-2/3" />
                      </div>
                    ) : (
                      <>
                        <div className="card p-5">
                          <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-black/5">
                            {msg.emotion && <EmotionBadge emotion={msg.emotion} small />}
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
                            <div className="flex items-center gap-2 mb-3 text-forest text-xs font-medium">
                              <Zap size={12} />
                              <span>Concept Diagram</span>
                            </div>
                            <MermaidDiagram chart={msg.diagram} />
                          </div>
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

        <div className="px-4 pb-safe pb-4 pt-3 border-t border-black/5 bg-cream/85 backdrop-blur-sm">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-saffron text-white mic-recording scale-105'
                  : 'bg-white border border-black/10 text-ink/60 hover:border-saffron/40 hover:text-saffron'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImage(e.target.files?.[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isOcrLoading}
              className="flex-shrink-0 w-12 h-12 rounded-full bg-white border border-black/10 text-ink/60 hover:border-forest/40 hover:text-forest flex items-center justify-center disabled:opacity-50"
              aria-label="Upload textbook photo"
            >
              {isOcrLoading ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />}
            </button>

            <div className="flex-1 relative">
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
                className="bangla w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 pr-12 text-sm focus:outline-none focus:border-saffron/40 transition-colors leading-relaxed"
                rows={1}
                style={{ minHeight: 48, maxHeight: 160 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-2 w-8 h-8 bg-saffron text-white rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-saffron/90 transition-all"
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
