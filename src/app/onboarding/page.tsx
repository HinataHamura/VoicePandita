'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap, Target } from 'lucide-react'
import { saveStudentProfile } from '@/lib/studentStore'

const steps = [
  {
    id: 'level',
    icon: GraduationCap,
    q: 'তুমি কোন লেভেলের student?',
    sub: 'VoicePandita এখন SSC/HSC/admission focused tutor.',
    opts: [
      { val: 'ssc', label: 'SSC', sub: 'Class 9-10 board preparation' },
      { val: 'hsc', label: 'HSC', sub: 'Class 11-12 board + admission base' },
    ],
  },
  {
    id: 'goal',
    icon: Target,
    q: 'তোমার main target কী?',
    sub: 'Answer format আর follow-up question এই অনুযায়ী বদলাবে।',
    opts: [
      { val: 'board', label: 'Board Exam', sub: 'SSC/HSC CQ, MCQ, short answer practice' },
      { val: 'admission', label: 'Admission', sub: 'Concept-first, fast problem solving' },
    ],
  },
  {
    id: 'group',
    icon: BookOpen,
    q: 'তোমার study group কোনটা?',
    sub: 'Subject selector আর curriculum context personalize হবে।',
    opts: [
      { val: 'science', label: 'Science', sub: 'Physics, Chemistry, Biology, Math' },
      { val: 'humanities', label: 'Humanities', sub: 'Bangla, English, general subjects' },
      { val: 'business', label: 'Business Studies', sub: 'Accounting, finance basics, commerce' },
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [dir, setDir] = useState(1)

  const current = steps[step]
  const selected = answers[current.id]
  const progress = ((step + 1) / steps.length) * 100
  const Icon = current.icon

  function pick(val: string) {
    setAnswers(prev => ({ ...prev, [current.id]: val }))
  }

  function next() {
    if (!selected) return
    if (step < steps.length - 1) {
      setDir(1)
      setStep(prev => prev + 1)
      return
    }
    saveStudentProfile({ ...answers, [current.id]: selected })
    router.push('/learn')
  }

  function back() {
    if (step === 0) {
      router.push('/')
      return
    }
    setDir(-1)
    setStep(prev => prev - 1)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-4 py-12">
      <div className="mb-10 w-full max-w-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs text-ink/40">{step + 1} / {steps.length}</span>
          <span className="text-xs font-medium text-forest">SSC/HSC setup</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-forest/8">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-saffron to-gold" animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>
      </div>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -dir * 50 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-forest to-indigo text-white shadow-xl shadow-forest/20">
              <Icon size={24} />
            </div>
            <h2 className="bangla mb-2 text-center font-display text-2xl font-bold leading-snug md:text-3xl">{current.q}</h2>
            <p className="bangla mb-8 text-center text-sm text-ink/55">{current.sub}</p>

            <div className="space-y-3">
              {current.opts.map(opt => (
                <button
                  key={opt.val}
                  onClick={() => pick(opt.val)}
                  className={`w-full rounded-lg border-2 p-4 text-left shadow-sm ${
                    selected === opt.val
                      ? 'border-saffron bg-saffron/7 shadow-md shadow-saffron/10'
                      : 'border-forest/10 bg-white/82 hover:border-saffron/35 hover:bg-paper/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${selected === opt.val ? 'border-saffron bg-saffron' : 'border-forest/20'}`}>
                      {selected === opt.val && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{opt.label}</div>
                      <div className="text-xs text-ink/50 mt-0.5">{opt.sub}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex w-full max-w-md items-center gap-3">
        <button onClick={back} className="flex items-center gap-1.5 px-3 py-2 text-sm text-ink/45 hover:text-ink">
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={next}
          disabled={!selected}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-4 text-base font-semibold ${
            selected
              ? 'bg-saffron text-white shadow-lg shadow-saffron/20 hover:-translate-y-0.5 hover:bg-saffron/90'
              : 'cursor-not-allowed bg-forest/8 text-ink/30'
          }`}
        >
          {step === steps.length - 1 ? 'Start learning' : 'Next'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
