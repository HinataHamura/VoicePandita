'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Volume2,
} from 'lucide-react'
import { getAuthenticatedStudent } from '@/lib/authFlow'
import type { StudentIdentity } from '@/lib/studentStore'

// ─── Types ────────────────────────────────────────────────────────────────────
type PracticeQuestion = {
  question: string
  expectedAnswer: string
  difficulty: 'easy' | 'medium' | 'hard'
  questionType?: string
}

type PracticeGrade = {
  score: number
  verdict: string
  feedback: string
  missingPoints: string[]
  modelAnswer: string
  nextStep: string
}

type PracticeTurn = PracticeQuestion & {
  id: string
  topic: string
  subject: string
  transcript: string
  grade?: PracticeGrade
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = ['physics', 'chemistry', 'biology', 'math', 'bangla', 'english', 'general']
const STORAGE_KEY = 'vp_voice_practice_turns'
const legacyStorageKey = STORAGE_KEY

function storageKey(studentId?: string) {
  return studentId ? `${STORAGE_KEY}:${studentId}` : STORAGE_KEY
}

// Question type labels shown in the UI badge
const QUESTION_TYPE_LABELS: Record<string, string> = {
  'definition':        'সংজ্ঞা',
  'explain-cause':     'কারণ ব্যাখ্যা',
  'real-example':      'উদাহরণ',
  'compare':           'তুলনা',
  'apply':             'প্রয়োগ',
  'importance':        'গুরুত্ব',
  'derive-formula':    'সূত্র',
  'true-false-reason': 'সত্য/মিথ্যা',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard:   'bg-red-100 text-red-700',
}

// ─── Speech helpers ───────────────────────────────────────────────────────────
function bestVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => v.lang.toLowerCase().startsWith('bn')) ||
    voices.find(v => /bangla|bengali/i.test(v.name)) ||
    voices.find(v => v.lang.toLowerCase().startsWith('en')) ||
    voices[0] ||
    null
  )
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(clean)
  const voice = bestVoice()
  utterance.lang = voice?.lang || 'bn-BD'
  utterance.rate = 0.94
  utterance.pitch = 1
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

// ─── Local storage helpers ────────────────────────────────────────────────────
function readTurns(studentId?: string): PracticeTurn[] {
  try {
    const saved = localStorage.getItem(storageKey(studentId)) || (!studentId ? null : localStorage.getItem(legacyStorageKey))
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function writeTurns(turns: PracticeTurn[], studentId?: string) {
  localStorage.setItem(storageKey(studentId), JSON.stringify(turns.slice(0, 80)))
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VoicePracticePage() {
  const [student, setStudent]                 = useState<StudentIdentity | null>(null)
  const [authLoading, setAuthLoading]         = useState(true)
  const [subject, setSubject]               = useState('physics')
  const [topic, setTopic]                   = useState('Newton second law')
  const [current, setCurrent]               = useState<PracticeQuestion | null>(null)
  const [transcript, setTranscript]         = useState('')
  const [grade, setGrade]                   = useState<PracticeGrade | null>(null)
  const [turns, setTurns]                   = useState<PracticeTurn[]>([])
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [isGrading, setIsGrading]           = useState(false)
  const [isRecording, setIsRecording]       = useState(false)
  const [error, setError]                   = useState('')

  const mediaRef       = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const chunksRef      = useRef<Blob[]>([])

  // Load saved turns on mount
  useEffect(() => {
    getAuthenticatedStudent().then(currentStudent => {
      if (!currentStudent) {
        window.location.replace('/login?next=/voice-practice')
        return
      }
      setStudent(currentStudent)
      setTurns(readTurns(currentStudent.id))
      setAuthLoading(false)
    })
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }
  }, [])

  // ── Derived stats ────────────────────────────────────────────────────────────
  // Memoize topic turns (re-computed when turns/topic change)
  const topicTurns = useMemo(
    () => turns.filter(t => t.topic.toLowerCase() === topic.trim().toLowerCase()),
    [turns, topic],
  )
  const answered   = topicTurns.filter(t => t.grade)
  const average    = answered.length
    ? Math.round(answered.reduce((s, t) => s + (t.grade?.score ?? 0), 0) / answered.length)
    : 0
  const best       = answered.reduce((m, t) => Math.max(m, t.grade?.score ?? 0), 0)
  const weakPoints = answered.flatMap(t => t.grade?.missingPoints ?? []).slice(0, 6)

  // ── Generate a new question ──────────────────────────────────────────────────
  async function newQuestion() {
    if (!topic.trim()) { setError('টপিক সেট করো প্রথমে।'); return }
    setError('')

    // ⬇ Clear UI immediately so the loading state is visible
    setCurrent(null)
    setGrade(null)
    setTranscript('')
    setIsLoadingQuestion(true)

    // ⬇ Capture turns synchronously — avoids stale-closure bug when called
    //   right after checkAnswer() updates the turns state.
    const freshTurns = readTurns(student?.id).filter(
      t => t.topic.toLowerCase() === topic.trim().toLowerCase(),
    )

    try {
      const res = await fetch('/api/voice-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question',
          subject,
          topic,
          // Pass full length so API can rotate question type correctly
          history: freshTurns.map(t => ({
            question:      t.question,
            studentAnswer: t.transcript,
            score:         t.grade?.score,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'প্রশ্ন তৈরি করা গেলো না।')

      const next: PracticeQuestion = {
        question:      String(data.question      || ''),
        expectedAnswer: String(data.expectedAnswer || ''),
        difficulty:    ['easy','medium','hard'].includes(String(data.difficulty))
                         ? data.difficulty : 'easy',
        questionType:  String(data.questionType  || 'definition'),
      }
      setCurrent(next)
      speak(next.question)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'প্রশ্ন তৈরি করা গেলো না।')
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  // ── Recording ────────────────────────────────────────────────────────────────
  async function startRecording() {
    if (!current) { setError('আগে একটি প্রশ্ন তৈরি করো।'); return }
    setError('')
    setTranscript('')

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.lang            = 'bn-BD'
      recognition.interimResults  = false
      recognition.maxAlternatives = 1
      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript
        if (text) setTranscript(text)
      }
      recognition.onerror = () => setError('ভয়েস ধরা গেলো না। আবার চেষ্টা করো।')
      recognition.onend   = () => setIsRecording(false)
      recognitionRef.current = recognition
      recognition.start()
      setIsRecording(true)
      return
    }

    // Fallback: MediaRecorder
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        await transcribeAudio(blob)
      }
      recorder.start()
      mediaRef.current = recorder
      setIsRecording(true)
    } catch {
      setError('মাইক্রোফোনের অনুমতি দরকার। টাইপ করেও উত্তর দিতে পারো।')
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop?.()
    mediaRef.current?.stop()
    setIsRecording(false)
  }

  async function transcribeAudio(blob: Blob) {
    setIsGrading(true)
    try {
      const form = new FormData()
      form.append('audio', blob, 'practice-answer.webm')
      const res  = await fetch('/api/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (data.text) setTranscript(data.text)
    } catch {
      setError('Transcription ব্যর্থ হয়েছে। উত্তর টাইপ করো।')
    } finally {
      setIsGrading(false)
    }
  }

  // ── Grade answer ─────────────────────────────────────────────────────────────
  async function checkAnswer() {
    if (!current || !transcript.trim()) {
      setError('আগে উত্তর রেকর্ড বা টাইপ করো।')
      return
    }
    setError('')
    setIsGrading(true)

    try {
      const res = await fetch('/api/voice-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'grade',
          subject,
          topic,
          question:       current.question,
          expectedAnswer: current.expectedAnswer,
          questionType:   current.questionType ?? 'definition',  // ← pass type to grader
          studentAnswer:  transcript,
          history:        topicTurns,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'উত্তর যাচাই করা গেলো না।')

      const result: PracticeGrade = {
        score:         Math.round(Number(data.score   ?? 0)),
        verdict:       String(data.verdict             || 'যাচাই হয়েছে'),
        feedback:      String(data.feedback            || ''),
        missingPoints: Array.isArray(data.missingPoints)
                         ? data.missingPoints.map(String) : [],
        modelAnswer:   String(data.modelAnswer         || current.expectedAnswer),
        nextStep:      String(data.nextStep            || 'পরের প্রশ্নে চেষ্টা করো।'),
      }
      setGrade(result)

      // Persist to localStorage
      const turn: PracticeTurn = {
        ...current,
        id:        crypto.randomUUID(),
        topic,
        subject,
        transcript,
        grade:     result,
        createdAt: new Date().toISOString(),
      }
      const nextTurns = [turn, ...turns]
      setTurns(nextTurns)
      writeTurns(nextTurns, student?.id)

      speak(result.feedback)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'উত্তর যাচাই করা গেলো না।')
    } finally {
      setIsGrading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="ai-shell min-h-dvh">

      {/* Header */}
      <header className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href="/learn"
            className="rounded-lg border border-white/60 bg-white/72 p-2 shadow-sm hover:bg-white"
            aria-label="Back to learn"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold">Voice Answer Checker</h1>
            <p className="text-xs text-ink/50">
              AI asks. Student speaks. VoicePandita checks recall and tracks progress.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1.08fr_0.92fr]">
        {authLoading ? (
          <div className="card p-5 text-sm text-ink/55 lg:col-span-2">
            <Loader2 size={16} className="mr-2 inline animate-spin text-forest" />
            Loading your practice space...
          </div>
        ) : (
          <>

        {/* ── Left column ── */}
        <section className="space-y-5">

          {/* Topic selector */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Target size={18} className="text-forest" />
              <h2 className="font-semibold">Set practice topic</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[0.55fr_1fr_auto]">
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="rounded-2xl border border-white/70 bg-white/85 px-3 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none"
              >
                {SUBJECTS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Topic, e.g. photosynthesis"
                className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none"
              />
              <button
                onClick={newQuestion}
                disabled={isLoadingQuestion || !topic.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-forest to-indigo px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-forest/15 disabled:opacity-45"
              >
                {isLoadingQuestion
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Sparkles size={16} />}
                Ask me
              </button>
            </div>
          </div>

          {/* Current question */}
          <div className="card min-h-[260px] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-indigo" />
                <h2 className="font-semibold">Current question</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Question type badge */}
                {current?.questionType && (
                  <span className="rounded-full bg-indigo/10 px-3 py-1 text-xs font-semibold text-indigo">
                    {QUESTION_TYPE_LABELS[current.questionType] ?? current.questionType}
                  </span>
                )}
                {/* Difficulty badge */}
                {current && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${DIFFICULTY_COLORS[current.difficulty]}`}>
                    {current.difficulty}
                  </span>
                )}
              </div>
            </div>

            {isLoadingQuestion ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-ink/50">
                <Loader2 size={28} className="animate-spin text-indigo" />
                <p className="text-sm">নতুন প্রশ্ন তৈরি হচ্ছে…</p>
              </div>
            ) : current ? (
              <div className="space-y-4">
                <p className="bangla text-2xl font-semibold leading-relaxed text-ink">
                  {current.question}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => speak(current.question)}
                    className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-4 py-2 text-sm font-semibold text-forest shadow-sm hover:bg-white"
                  >
                    <Volume2 size={15} /> Listen
                  </button>
                  <button
                    type="button"
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${
                      isRecording
                        ? 'bg-gradient-to-br from-forest to-indigo text-white'
                        : 'border border-white/70 bg-white/80 text-ink/70 hover:text-forest'
                    }`}
                  >
                    {isRecording ? <Mic size={16} /> : <MicOff size={16} />}
                    {isRecording ? 'Recording…' : 'Hold to answer'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center text-center text-ink/50">
                <BookOpenCheck size={34} className="mb-3 text-forest" />
                <p className="text-sm">Choose a topic, then press <strong>Ask me</strong>.</p>
              </div>
            )}
          </div>

          {/* Answer box */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Your spoken answer</h2>
              <button
                onClick={checkAnswer}
                disabled={!current || !transcript.trim() || isGrading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-forest to-indigo px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
              >
                {isGrading
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Send size={15} />}
                Check
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Transcript will appear here. You can edit it before checking."
              className="bangla min-h-28 w-full resize-y rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
            />
            {error && (
              <p className="mt-3 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>
            )}
          </div>
        </section>

        {/* ── Right column ── */}
        <aside className="space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Attempts', value: answered.length,  Icon: BarChart3   },
              { label: 'Average',  value: `${average}%`,    Icon: Target      },
              { label: 'Best',     value: `${best}%`,       Icon: CheckCircle2 },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="card p-4">
                <Icon size={17} className="mb-3 text-forest" />
                <div className="font-display text-2xl font-bold">{value}</div>
                <div className="text-xs text-ink/50">{label}</div>
              </div>
            ))}
          </div>

          {/* Grade panel */}
          {grade ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{grade.verdict}</div>
                  <div className="text-xs text-ink/45">Latest feedback</div>
                </div>
                <div className="rounded-2xl bg-forest/10 px-4 py-2 font-display text-2xl font-bold text-forest">
                  {grade.score}%
                </div>
              </div>

              <p className="bangla leading-relaxed text-ink/75">{grade.feedback}</p>

              {!!grade.missingPoints.length && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
                    Missing points
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {grade.missingPoints.map(point => (
                      <span
                        key={point}
                        className="rounded-full bg-saffron/15 px-3 py-1 text-xs font-medium text-orange-700"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-white/65 p-4">
                <div className="mb-1 text-xs font-semibold text-forest">Model answer</div>
                <p className="bangla text-sm leading-relaxed text-ink/70">{grade.modelAnswer}</p>
              </div>

              {grade.nextStep && (
                <div className="mt-3 rounded-xl bg-indigo/8 px-4 py-3">
                  <div className="mb-1 text-xs font-semibold text-indigo">Next step</div>
                  <p className="bangla text-sm text-ink/70">{grade.nextStep}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {/* ← This button now correctly fires newQuestion with fresh state */}
                <button
                  onClick={newQuestion}
                  disabled={isLoadingQuestion}
                  className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-4 py-2 text-sm font-semibold text-forest shadow-sm hover:bg-white disabled:opacity-40"
                >
                  {isLoadingQuestion
                    ? <Loader2 size={15} className="animate-spin" />
                    : <RotateCcw size={15} />}
                  Next question
                </button>
                <button
                  onClick={() => speak(grade.modelAnswer)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/75 px-4 py-2 text-sm font-semibold text-ink/65 shadow-sm hover:bg-white"
                >
                  <Volume2 size={15} /> Hear model
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Sparkles size={17} className="text-forest" />
                Feedback appears here
              </div>
              <p className="text-sm leading-relaxed text-ink/55">
                After the student speaks, VoicePandita will grade concept accuracy,
                show missing points, and suggest the next step.
              </p>
            </div>
          )}

          {/* Learning trace */}
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Learning trace for this topic</h2>

            {weakPoints.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
                  Often missing
                </div>
                <div className="flex flex-wrap gap-2">
                  {weakPoints.map((point, i) => (
                    <span
                      key={`${point}-${i}`}
                      className="rounded-full bg-clay/10 px-3 py-1 text-xs font-medium text-clay"
                    >
                      {point}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Question-type coverage pills */}
            {topicTurns.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
                  Question types practised
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Set(topicTurns.map(t => t.questionType).filter(Boolean))
                  ).map(qt => (
                    <span
                      key={qt}
                      className="rounded-full bg-indigo/10 px-3 py-1 text-xs font-medium text-indigo"
                    >
                      {QUESTION_TYPE_LABELS[qt!] ?? qt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {topicTurns.slice(0, 5).map(turn => (
                <div
                  key={turn.id}
                  className="rounded-2xl border border-white/70 bg-white/65 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{turn.question}</div>
                    <div className="flex shrink-0 items-center gap-1">
                      {turn.questionType && (
                        <span className="rounded-full bg-indigo/10 px-2 py-0.5 text-xs text-indigo">
                          {QUESTION_TYPE_LABELS[turn.questionType] ?? turn.questionType}
                        </span>
                      )}
                      {turn.grade && (
                        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-forest">
                          {turn.grade.score}%
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-ink/50">
                    {turn.transcript || 'No answer transcript'}
                  </p>
                </div>
              ))}
              {!topicTurns.length && (
                <p className="text-sm text-ink/50">No attempts yet for this topic.</p>
              )}
            </div>
          </div>
        </aside>
          </>
        )}
      </main>
    </div>
  )
}
