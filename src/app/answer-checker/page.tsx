'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileImage,
  ImageUp,
  Loader2,
  PenLine,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react'

type CheckResult = {
  extractedAnswer: string
  marksAwarded: number
  maxMarks: number
  percentage: number
  verdict: string
  contentFeedback: string
  writingFeedback: string
  strengths: string[]
  missingPoints: string[]
  improvementPlan: string[]
  modelAnswer: string
  error?: string
}

type SavedCheck = CheckResult & {
  id: string
  question: string
  subject: string
  createdAt: string
}

const SUBJECTS = ['physics', 'chemistry', 'biology', 'math', 'bangla', 'english', 'general']
const STORAGE_KEY = 'vp_handwritten_checks'

function readChecks(): SavedCheck[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function writeChecks(checks: SavedCheck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checks.slice(0, 60)))
}

export default function AnswerCheckerPage() {
  const [subject, setSubject] = useState('physics')
  const [question, setQuestion] = useState('')
  const [expectedAnswer, setExpectedAnswer] = useState('')
  const [maxMarks, setMaxMarks] = useState(10)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [history, setHistory] = useState<SavedCheck[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHistory(readChecks())
  }, [])

  const average = useMemo(() => {
    if (!history.length) return 0
    return Math.round(history.reduce((sum, item) => sum + item.percentage, 0) / history.length)
  }, [history])

  function chooseFile(nextFile?: File | null) {
    if (!nextFile) return
    setFile(nextFile)
    setResult(null)
    setError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(nextFile))
  }

  function resetForm() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl('')
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function checkAnswer() {
    if (!file) {
      setError('Upload a handwritten answer image first.')
      return
    }
    setError('')
    setIsChecking(true)
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('subject', subject)
      form.append('question', question)
      form.append('expectedAnswer', expectedAnswer)
      form.append('maxMarks', String(maxMarks))

      const res = await fetch('/api/handwritten-check', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not check answer.')

      const checked: CheckResult = {
        extractedAnswer: String(data.extractedAnswer || ''),
        marksAwarded: Number(data.marksAwarded || 0),
        maxMarks: Number(data.maxMarks || maxMarks),
        percentage: Math.round(Number(data.percentage || 0)),
        verdict: String(data.verdict || 'Checked'),
        contentFeedback: String(data.contentFeedback || ''),
        writingFeedback: String(data.writingFeedback || ''),
        strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
        missingPoints: Array.isArray(data.missingPoints) ? data.missingPoints.map(String) : [],
        improvementPlan: Array.isArray(data.improvementPlan) ? data.improvementPlan.map(String) : [],
        modelAnswer: String(data.modelAnswer || ''),
        error: data.error ? String(data.error) : undefined,
      }
      setResult(checked)

      const saved: SavedCheck = {
        ...checked,
        id: crypto.randomUUID(),
        question,
        subject,
        createdAt: new Date().toISOString(),
      }
      const nextHistory = [saved, ...history]
      setHistory(nextHistory)
      writeChecks(nextHistory)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check answer.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link href="/learn" className="rounded-lg border border-white/60 bg-white/72 p-2 shadow-sm hover:bg-white" aria-label="Back to learn">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold">Handwritten Answer Checker</h1>
            <p className="text-xs text-ink/50">Upload a written answer. AI gives marks, feedback, and writing improvement tips.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-5">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-forest" />
              <h2 className="font-semibold">Answer details</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[0.55fr_0.35fr]">
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="rounded-2xl border border-white/70 bg-white/85 px-3 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none"
              >
                {SUBJECTS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <input
                type="number"
                min={1}
                max={100}
                value={maxMarks}
                onChange={e => setMaxMarks(Math.max(1, Math.min(100, Number(e.target.value || 10))))}
                className="rounded-2xl border border-white/70 bg-white/85 px-3 py-3 text-sm shadow-sm focus:border-forest/35 focus:outline-none"
                aria-label="Maximum marks"
              />
            </div>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Question prompt. Example: What is photosynthesis?"
              className="mt-3 min-h-20 w-full resize-y rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
            />
            <textarea
              value={expectedAnswer}
              onChange={e => setExpectedAnswer(e.target.value)}
              placeholder="Optional rubric/model answer. This makes marking more accurate."
              className="mt-3 min-h-24 w-full resize-y rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm leading-relaxed shadow-sm focus:border-forest/35 focus:outline-none"
            />
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileImage size={18} className="text-indigo" />
                <h2 className="font-semibold">Handwritten image</h2>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => chooseFile(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-4 py-2 text-sm font-semibold text-forest shadow-sm hover:bg-white"
              >
                <ImageUp size={15} /> Upload
              </button>
            </div>

            {previewUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/70">
                <img src={previewUrl} alt="Uploaded handwritten answer preview" className="max-h-[420px] w-full object-contain" />
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-forest/25 bg-white/55 text-center text-ink/50 hover:bg-white/75"
              >
                <ImageUp size={34} className="mb-3 text-forest" />
                <span className="text-sm font-semibold">Upload handwritten answer photo</span>
                <span className="mt-1 text-xs">PNG, JPG, or WEBP under 5MB</span>
              </button>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={checkAnswer}
                disabled={!file || isChecking}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-forest to-indigo px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
              >
                {isChecking ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Check answer
              </button>
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/75 px-4 py-2.5 text-sm font-semibold text-ink/65 shadow-sm hover:bg-white"
              >
                <RotateCcw size={15} /> Reset
              </button>
            </div>
            {error && <p className="mt-3 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Checks', value: history.length, Icon: ClipboardCheck },
              { label: 'Average', value: `${average}%`, Icon: Target },
              { label: 'Last', value: result ? `${result.percentage}%` : '-', Icon: CheckCircle2 },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="card p-4">
                <Icon size={17} className="mb-3 text-forest" />
                <div className="font-display text-2xl font-bold">{value}</div>
                <div className="text-xs text-ink/50">{label}</div>
              </div>
            ))}
          </div>

          {result ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{result.verdict}</div>
                  <div className="text-xs text-ink/45">Marks awarded</div>
                </div>
                <div className="rounded-2xl bg-forest/10 px-4 py-2 font-display text-2xl font-bold text-forest">
                  {result.marksAwarded}/{result.maxMarks}
                </div>
              </div>

              {result.error && <p className="mb-3 rounded-xl bg-saffron/15 px-3 py-2 text-xs text-orange-700">{result.error}</p>}

              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forest">
                    <ClipboardCheck size={13} /> Content feedback
                  </div>
                  <p className="bangla leading-relaxed text-ink/75">{result.contentFeedback}</p>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo">
                    <PenLine size={13} /> Writing feedback
                  </div>
                  <p className="bangla leading-relaxed text-ink/75">{result.writingFeedback}</p>
                </div>
              </div>

              {!!result.strengths.length && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Strengths</div>
                  <div className="flex flex-wrap gap-2">
                    {result.strengths.map(item => (
                      <span key={item} className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {!!result.missingPoints.length && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">Missing points</div>
                  <div className="flex flex-wrap gap-2">
                    {result.missingPoints.map(item => (
                      <span key={item} className="rounded-full bg-clay/10 px-3 py-1 text-xs font-medium text-clay">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {!!result.improvementPlan.length && (
                <div className="mt-4 rounded-2xl bg-white/65 p-4">
                  <div className="mb-2 text-xs font-semibold text-forest">How to improve</div>
                  <ol className="space-y-2 text-sm text-ink/70">
                    {result.improvementPlan.map((item, index) => (
                      <li key={item} className="flex gap-2">
                        <span className="font-semibold text-forest">{index + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Sparkles size={17} className="text-forest" />
                Marks and feedback appear here
              </div>
              <p className="text-sm leading-relaxed text-ink/55">
                Upload a handwritten answer and add the question or rubric. VoicePandita will grade the answer and explain how to improve the writing.
              </p>
            </div>
          )}

          {result?.extractedAnswer && (
            <div className="card p-5">
              <h2 className="mb-2 font-semibold">Extracted answer</h2>
              <p className="bangla whitespace-pre-line text-sm leading-relaxed text-ink/70">{result.extractedAnswer}</p>
            </div>
          )}

          {result?.modelAnswer && (
            <div className="card p-5">
              <h2 className="mb-2 font-semibold">Improved model answer</h2>
              <p className="bangla whitespace-pre-line text-sm leading-relaxed text-ink/70">{result.modelAnswer}</p>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Recent checks</h2>
            <div className="space-y-3">
              {history.slice(0, 5).map(item => (
                <div key={item.id} className="rounded-2xl border border-white/70 bg-white/65 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{item.question || item.subject}</div>
                    <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-forest">{item.marksAwarded}/{item.maxMarks}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-ink/50">{item.verdict}</p>
                </div>
              ))}
              {!history.length && <p className="text-sm text-ink/50">No handwritten answers checked yet.</p>}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
